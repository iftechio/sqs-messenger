import * as Bluebird from 'bluebird'
import * as MNS from '@ruguoapp/mns-node-sdk'

import Producer from './producer'
import Queue from './queue'
import Topic from './topic'
import Consumer from './consumer'

/**
 * Default error handler, print error to console.
 */
function loggingErrorHandler(...args) {
  console.error.apply(
    undefined,
    ['[sqs-messenger]'].concat(
      Array.prototype.map.call(args, arg => (arg instanceof Error ? arg.stack : arg)),
    ),
  )
}

class Messenger {
  mns: MNS.Client
  queueMap: { [name: string]: Queue } = {}
  topicMap: { [name: string]: Topic } = {}
  producer: Producer
  errorHandler: (...args: any[]) => void

  constructor(
    mns: MNS.Client,
    errorHandler?: (...args: any[]) => void,
  ) {
    this.mns = mns
    this.producer = new Producer(mns)
    this.errorHandler = errorHandler || loggingErrorHandler
  }

  /**
   * Register a message handler on a queue
   */
  _on<T = any>(
    queueName: string,
    handler: (message: T | T[], callback: (err?: Error) => void) => void,
    opts: {
      batchHandle: boolean
      consumers?: number
      batchSize?: number
      visibilityTimeout?: number
    },
  ): Consumer<T> | Consumer<T>[] {
    const queue = this.queueMap[queueName]
    if (!queue) {
      throw new Error('Queue not found: ' + queueName)
    }

    const consumers: Consumer<T>[] = []
    for (let i = 0; i < (opts.consumers || 1); i++) {
      const consumer = queue.onMessage<T>(handler, opts)
      consumer.on('error', this.errorHandler)
      consumers.push(consumer)
    }
    return consumers.length > 1 ? consumers : consumers[0]
  }

  on<T = any>(
    queueName: string,
    handler: (message: T, callback: (err?: Error) => void) => void,
    opts: {
      batchSize?: number
      consumers?: number
      visibilityTimeout?: number
    } = {},
  ): Consumer<T> | Consumer<T>[] {
    return this._on(queueName, handler, {
      ...opts,
      batchHandle: false,
    })
  }

  onBatch<T = any>(
    queueName: string,
    handler: (messages: T[], callback: (err?: Error) => void) => void,
    opts: {
      batchSize?: number
      consumers?: number
      visibilityTimeout?: number
    } = {},
  ): Consumer<T> | Consumer<T>[] {
    return this._on(queueName, handler, {
      ...opts,
      batchHandle: true,
    })
  }

  async sendTopicMessage<T extends object = any>(
    key: string,
    msg: T,
  ): Promise<MNS.Types.PublishMessageResponse> {
    const topic = this.topicMap[key]
    if (!topic) {
      throw new Error(`Topic[${key}] not found`)
    }
    return this.producer.sendTopic<T>(topic, msg)
  }

  async sendQueueMessage<T extends object = any>(
    key: string,
    msg: T,
    opts?: { DelaySeconds?: number },
  ): Promise<MNS.Types.SendMessageResponse> {
    const queue = this.queueMap[key]
    if (!queue) {
      throw new Error(`Queue[${key}] not found`)
    }
    return this.producer.sendQueue<T>(queue, msg, opts)
  }

  /**
   * Create a topic with specific name, will declare the SNS topic if not exists
   */
  createTopic(
    name: string,
    opts: {
      MaximumMessageSize?: number
      LoggingEnabled?: boolean
    } = {},
  ): Topic {
    const topic = new Topic(this.mns, name, opts)
    topic.on('error', this.errorHandler)

    this.topicMap[name] = topic
    return topic
  }

  /**
   * Create a queue with specific name, will declare the SQS queue if not exists
   */
  createQueue(
    name: string,
    opts: {
      bindTopic?: Topic
      bindTopics?: Topic[]
      delaySeconds?: number
      maximumMessageSize?: number
      messageRetentionPeriod?: number
      visibilityTimeout?: number
      pollingWaitSeconds?: number
      loggingEnabled?: boolean
    } = {},
  ): Queue {
    const queue = new Queue(this.mns, name, opts)
    queue.on('error', this.errorHandler)

    if (opts.bindTopics || opts.bindTopic) {
      const bindTopics = opts.bindTopics || [opts.bindTopic!]
      // Wait for queue being ready, topic will handle itself if is not ready
      if (queue.isReady) {
        bindTopics.forEach(topic => topic.subscribe(queue, `${queue.name}-to-${topic.name}`))
      } else {
        queue.on('ready', () =>
          bindTopics.forEach(topic => topic.subscribe(queue, `${queue.name}-to-${topic.name}`)),
        )
      }
    }
    this.queueMap[name] = queue
    return queue
  }

  /**
   * Gracefully shutdown each queue within `timeout`
   */
  async shutdown(timeout: number): Promise<void[][]> {
    const queues = Object.values(this.queueMap)
    return Bluebird.map(queues, queue => {
      return queue.shutdown(timeout)
    })
  }

  async ready(): Promise<void> {
    await Promise.all(
      [...Object.values(this.queueMap), ...Object.values(this.topicMap)].map(async item => {
        if (item.isReady) {
          return
        }
        return new Promise(resolve => {
          item.on('ready', () => resolve())
        })
      }),
    )
  }
}

export default Messenger
