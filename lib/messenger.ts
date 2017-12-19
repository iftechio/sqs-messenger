import * as Promise from 'bluebird'
import { SQS, SNS } from 'aws-sdk'

import * as config from './config'
import Producer from './producer'
import Queue from './queue'
import Topic from './topic'

const TYPES = {
  TOPIC: 'topic',
  QUEUE: 'queue',
}

const queueMap = {}
const topicMap = {}

/**
 * Default error handler, print error to console.
 * @param args
 */
function loggingErrorHandler(...args) {
  console.error.apply(undefined, ['[sqs-messenger]'].concat(
    Array.prototype.map.call(args, arg => (arg instanceof Error ? arg.stack : arg))))
}

class Messenger {
  static sqs = new SQS({
    region: 'cn-north-1',
    apiVersion: '2012-11-05',
  })
  static sns = new SNS({
    region: 'cn-north-1',
    apiVersion: '2010-03-31',
  })
  producer: Producer
  errorHandler: (...args: any[]) => void
  sendTopicMessage: Function
  sendQueueMessage: Function

  /**
   * Construct messenger
   *
   * @param {Object} clients.sqs - Configured SQS client
   * @param {Object} clients.sns - Configured SNS client
   * @param {String} configs.arnPrefix
   * @param {String} configs.queueUrlPrefix
   * @param {String} [configs.resourceNamePrefix=""]
   * @param {Function} [configs.errorHandler=loggingErrorHandler]
   */
  constructor(configs) {
    config.set(configs || {})

    this.producer = new Producer(Messenger.sqs, Messenger.sns)
    this.errorHandler = configs.errorHandler || loggingErrorHandler

    this.sendTopicMessage = this.send.bind(this, TYPES.TOPIC)
    this.sendQueueMessage = this.send.bind(this, TYPES.QUEUE)
  }

  /**
   * Register a message handler on a queue
   *
   * @param {Queue} queue
   * @param {Function} handler
   * @param {Number} [opts.batchSize=10]
   * @param {Number} [opts.consumers=1]
   * @param {Boolean} [opts.batchHandle=false]
   */
  on(queue, handler, opts: any = {}) {
    if (typeof queue === 'string') {
      queue = queueMap[queue]
    }
    if (!queue) {
      throw new Error('Queue not found')
    }

    let consumers: any[] = []
    const consumersNum = opts.consumers || 1
    for (let i = 0; i < consumersNum; i++) {
      const consumer = queue.onMessage(handler, opts)
      consumer.on('error', this.errorHandler)
      consumers.push(consumer)
    }
    return consumers.length > 1 ? consumers : consumers[0]
  }

  /**
   * Register error handler.
   *
   * @param {Function} errHandler
   */
  onError(errHandler) {
    this.errorHandler = errHandler
  }

  /**
   * Send message to specific topic or queue, messages will be dropped
   * if SQS queue or SNS topic in the process of declaring.
   *
   * @param {String} [type='topic'] - 'topic' or 'queue'
   * @param {String} key - resource key, topic or queue name
   * @param {Object} msg - the payload to send
   * @param {Object} [options] - options for sqs message
   * @param {Number} options.DelaySeconds
   * @returns {Promise}
   */
  send(type, key, msg, options?) {
    if (arguments.length < 2) {
      return Promise.reject(new Error('Invalid parameter list'))
    }
    if (arguments.length === 2) {
      return this.send(TYPES.QUEUE, type, key)
    }
    // send with options
    if (arguments.length === 3 && typeof key === 'object') {
      return this.send(TYPES.QUEUE, type, key, msg)
    }
    if (type === TYPES.TOPIC) {
      const topic = topicMap[key]
      if (!topic) {
        throw new Error(`Topic[${key}] not found`)
      }
      return this.producer.sendTopic(topic, msg)
    } else if (type === TYPES.QUEUE) {
      const queue = queueMap[key]
      if (!queue) {
        throw new Error(`Queue[${key}] not found`)
      }
      return this.producer.sendQueue(queue, msg, options)
    }
    return Promise.reject(new Error(`Resource type not supported for ${type}`))
  }

  /**
   * Create a topic with specific name, will declare the SNS topic if not exists
   *
   * @param {String} name - the topic name, internal name could be
   *                        different from this depend on environment
   * @returns {Topic}
   */
  createTopic(name) {
    const topic = new Topic(Messenger.sns, name)
    topic.on('error', this.errorHandler)

    topicMap[name] = topic
    return topic
  }

  /**
   * Create a queue with specific name, will declare the SQS queue if not exists
   *
   * @param {String} name - the queue name, internal name could be different
   *                        from this depend on environment
   * @param {Object} [opts] - Queue options
   * @param {Topic} [opts.bindTopic] - the topic to subscribe on
   * @param {Array} [opts.bindTopics] - multiple topics to subscribe on
   * @param {Boolean} [opts.withDeadLetter=false]
   * @param {String} [opts.deadLetterQueueName]
   * @param {Number} [opts.visibilityTimeout=30]
   * @param {Number} [opts.maximumMessageSize=262144] - 256KB
   * @returns {Queue}
   */
  createQueue(name, opts: any = {}) {
    const queue = new Queue(Messenger.sqs, name, opts)
    queue.on('error', this.errorHandler)

    if (opts.bindTopics || opts.bindTopic) {
      opts.bindTopics = opts.bindTopics || [opts.bindTopic]
      // Wait for queue being ready, topic will handle itself if is not ready
      if (queue.isReady) {
        opts.bindTopics.forEach(topic => topic.subscribe(queue))
      } else {
        queue.on('ready', () =>
          opts.bindTopics.forEach(topic => topic.subscribe(queue))
        )
      }
    }
    queueMap[name] = queue
    return queue
  }

  /**
   * Gracefully shutdown each queue within `timeout`
   *
   * @param {Number} timeout
   * @returns {Promise}
   */
  shutdown(timeout) {
    const queues = Object.keys(queueMap).map(queueName => queueMap[queueName])
    return Promise.map(queues, (queue) => {
      return queue.shutdown(timeout)
    })
  }
}

export default Messenger
