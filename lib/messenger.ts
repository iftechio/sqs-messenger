import * as bluebird from 'bluebird'
import { SQS, SNS } from 'aws-sdk'

import Config from './config'
import Producer from './producer'
import Queue from './queue'
import Topic from './topic'
import Consumer from './consumer'

const TYPES: {
  TOPIC: 'topic'
  QUEUE: 'queue'
} = {
    TOPIC: 'topic',
    QUEUE: 'queue',
  }

/**
 * Default error handler, print error to console.
 * @param args
 */
function loggingErrorHandler(...args) {
  console.error.apply(undefined, ['[sqs-messenger]'].concat(
    Array.prototype.map.call(args, arg => (arg instanceof Error ? arg.stack : arg))))
}

class Messenger {
  sqs: SQS
  sns: SNS
  queueMap: { [name: string]: Queue } = {}
  topicMap: { [name: string]: Topic } = {}
  config: Config
  producer: Producer
  errorHandler: (...args: any[]) => void
  sendTopicMessage: Function
  sendQueueMessage: Function

  constructor({ sqs, sns }: { sqs: SQS, sns: SNS }, conf: {
    snsArnPrefix?: string
    sqsArnPrefix?: string
    queueUrlPrefix?: string
    resourceNamePrefix?: string
    errorHandler?: (...args: any[]) => void
  }) {
    this.sqs = sqs
    this.sns = sns
    this.config = new Config(conf)
    this.producer = new Producer({ sqs, sns })
    this.errorHandler = conf.errorHandler || loggingErrorHandler
    this.sendTopicMessage = this.send.bind(this, TYPES.TOPIC)
    this.sendQueueMessage = this.send.bind(this, TYPES.QUEUE)
  }

  /**
   * Register a message handler on a queue
   */
  on<T = any>(queueName: string, handler: (message: T | T[], callback: (err?: Error) => void) => void, opts: {
    batchSize?: number
    consumers?: number
    batchHandle?: boolean
  } = {}): Consumer | Consumer[] {
    const queue = this.queueMap[queueName]
    if (!queue) {
      throw new Error('Queue not found')
    }

    let consumers: Consumer[] = []
    const consumersNum = opts.consumers || 1
    for (let i = 0; i < consumersNum; i++) {
      const consumer = queue.onMessage<T>(handler, opts)
      consumer.on('error', this.errorHandler)
      consumers.push(consumer)
    }
    return consumers.length > 1 ? consumers : consumers[0]
  }

  /**
   * Send message to specific topic or queue, messages will be dropped
   * if SQS queue or SNS topic in the process of declaring.
   */
  async send<T = any>(type: 'topic' | 'queue', key: string, msg: T | any, options?: SQS.SendMessageRequest): Promise<SNS.Types.PublishResponse | SQS.Types.SendMessageResult> {
    if (arguments.length < 2) {
      return Promise.reject(new Error('Invalid parameter list'))
    }
    if (arguments.length === 2) {
      return this.send<T>(TYPES.QUEUE, type, key)
    }
    // send with options
    if (arguments.length === 3 && typeof key === 'object') {
      return this.send<T>(TYPES.QUEUE, type, key, msg)
    }
    if (type === TYPES.TOPIC) {
      const topic = this.topicMap[key]
      if (!topic) {
        throw new Error(`Topic[${key}] not found`)
      }
      return this.producer.sendTopic<T>(topic, msg)
    } else if (type === TYPES.QUEUE) {
      const queue = this.queueMap[key]
      if (!queue) {
        throw new Error(`Queue[${key}] not found`)
      }
      return this.producer.sendQueue<T>(queue, msg, options)
    }
    return Promise.reject(new Error(`Resource type not supported for ${type}`))
  }

  /**
   * Create a topic with specific name, will declare the SNS topic if not exists
   */
  createTopic(name: string): Topic {
    const topic = new Topic(this.sns, name, this.config)
    topic.on('error', this.errorHandler)

    this.topicMap[name] = topic
    return topic
  }

  /**
   * Create a queue with specific name, will declare the SQS queue if not exists
   */
  createQueue(name: string, opts: {
    bindTopic?: Topic
    bindTopics?: Topic[]
    withDeadLetter?: boolean
    visibilityTimeout?: number
    maximumMessageSize?: number
  } = {}): Queue {
    const queue = new Queue(this.sqs, name, opts, this.config)
    queue.on('error', this.errorHandler)

    if (opts.bindTopics || opts.bindTopic) {
      const bindTopics = opts.bindTopics || [opts.bindTopic!]
      // Wait for queue being ready, topic will handle itself if is not ready
      if (queue.isReady) {
        bindTopics.forEach(topic => topic.subscribe(queue))
      } else {
        queue.on('ready', () =>
          bindTopics.forEach(topic => topic.subscribe(queue))
        )
      }
    }
    this.queueMap[name] = queue
    return queue
  }

  /**
   * Gracefully shutdown each queue within `timeout`
   *
   * @param {Number} timeout
   * @returns {Promise}
   */
  async shutdown(timeout: number): Promise<void> {
    const queues = Object.keys(this.queueMap).map(queueName => this.queueMap[queueName])
    return bluebird.map(queues, (queue) => {
      return queue.shutdown(timeout)
    })
  }
}

export default Messenger
