const Promise = require('bluebird')

const clientsHolder = require('./clients')
const config = require('./config')
const Producer = require('./producer')
const Queue = require('./queue')
const Topic = require('./topic')
const jsonProtocol = require('./protocols/jsonProtocol')

const TYPES = {
  TOPIC: 'topic',
  QUEUE: 'queue',
}

const queueMap = {}
const topicMap = {}

/**
 * Construct messenger
 *
 * @param {Object} clients.sqs - Configured SQS client
 * @param {Object} clients.sns - Configured SNS client
 * @param {String} configs.arnPrefix
 * @param {String} configs.queueUrlPrefix
 * @param {String} [configs.resourceNamePrefix=""]
 * @param {Object} [configs.protocol=jsonProtocol]
 * @constructor
 */
function Messenger(clients, configs) {
  if (!clients.sqs) {
    throw Error('SQS client required')
  }
  clientsHolder.set(clients)
  config.set(configs || {})

  this.protocol = configs.protocol || jsonProtocol
  this.producer = new Producer(this.protocol)

  this.sendTopicMessage = this.send.bind(this, TYPES.TOPIC)
  this.sendQueueMessage = this.send.bind(this, TYPES.QUEUE)
}

/**
 * Register a message handler on a queue
 *
 * @param {Queue} queue
 * @param {Function} handler
 * @param {Number} [opts.batchSize=10]
 */
Messenger.prototype.on = function (queue, handler, opts) {
  if (typeof queue === 'string') {
    queue = queueMap[queue]
  }
  opts = opts || {}
  opts.protocol = this.protocol
  return queue.onMessage(handler, opts)
}

/**
 * Send message to specific topic or queue, messages will be dropped
 * if SQS queue or SNS topic in the process of declaring.
 *
 * @param {String} [type='topic'] - 'topic' or 'queue'
 * @param {String} key - resource key, topic or queue name
 * @param {Object} msg - the payload to send
 * @returns {Promise}
 */
Messenger.prototype.send = function (type, key, msg) {
  if (arguments.length < 2) {
    return Promise.reject(new Error('Invalid parameter list'))
  }
  if (arguments.length === 2) {
    return this.send(TYPES.QUEUE, type, key)
  }
  if (type === TYPES.TOPIC) {
    const topic = topicMap[key]
    return this.producer.sendTopic(topic, msg)
  } else if (type === TYPES.QUEUE) {
    const queue = queueMap[key]
    return this.producer.sendQueue(queue, msg)
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
Messenger.prototype.createTopic = function (name) {
  const topic = new Topic(name)
  topicMap[name] = topic
  return topic
}

/**
 * Create a queue with specific name, will declare the SQS queue if not exists
 *
 * @param {String} name - the queue name, internal name could be different
 *                        from this depend on environment
 * @param {Topic} [bindTopic] - the topic to subscribe on
 * @returns {Queue}
 */
Messenger.prototype.createQueue = function (name, bindTopic) {
  const queue = new Queue(name)
  if (bindTopic) {
    // Wait for queue being ready, topic will handle itself if is not ready
    if (queue.isReady) {
      bindTopic.subscribe(queue)
    } else {
      queue.on('ready', () => bindTopic.subscribe(queue))
    }
  }
  queueMap[name] = queue
  return queue
}

module.exports = Messenger
