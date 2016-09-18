const debug = require('debug')('sqs-messenger:queue')
const clients = require('./clients')
const Promise = require('bluebird')
const EventEmitter = require('events').EventEmitter
const util = require('util')

const config = require('./config')
const Consumer = require('./consumer')

/**
 * Construct an SQS queue.
 * @param {String} name
 * @param {Boolean} [opts.withDeadLetter=false]
 * @param {String} [opts.deadLetterQueueName]
 * @param {Number} [opts.visibilityTimeout=30]
 * @param {Number} [opts.maximumMessageSize=262144] - 256KB
 * @param {Number} [opts.isDeadLetterQueue=false]
 * @constructor
 */
function Queue(name, opts) {
  opts = opts || {}
  this.opts = {
    withDeadLetter: (typeof opts.withDeadLetter === 'boolean') ? opts.withDeadLetter : false,
    visibilityTimeout: (opts.visibilityTimeout || 30).toString(),
    maximumMessageSize: (opts.maximumMessageSize || 262144).toString(),
    isDeadLetterQueue: (typeof opts.isDeadLetterQueue === 'boolean') ? opts.isDeadLetterQueue : false,
  }
  this.name = name
  this.realName = config.getResourceNamePrefix() + name
  this.arn = config.getSqsArnPrefix() + this.realName
  this.isReady = false

  this._createQueue().then(data => {
    debug('Queue created', data)
    this.queueUrl = data.QueueUrl
    this.isReady = true
    this.emit('ready')
  })
}

util.inherits(Queue, EventEmitter)

Queue.prototype._createQueue = function () {
  debug(`Creating queue ${this.realName}`)
  const opts = this.opts
  const createParams = opts.isDeadLetterQueue ? { QueueName: this.realName } : {
    QueueName: this.realName,
    Attributes: {
      MaximumMessageSize: opts.maximumMessageSize,
      VisibilityTimeout: opts.visibilityTimeout,
      Policy: `{
          "Version": "2012-10-17",
          "Id": "${config.getSqsArnPrefix()}${this.realName}/SQSDefaultPolicy",
          "Statement": [
            {
              "Sid": "1",
              "Effect": "Allow",
              "Principal": "*",
              "Action": "SQS:SendMessage",
              "Resource": "${config.getSqsArnPrefix()}${this.realName}"
            }
          ]
        }`.replace(/\s/g, ''),
    },
  }

  return new Promise((resolve, reject) => {
    if (opts.withDeadLetter) {
      opts.deadLetterQueueName = opts.deadLetterQueueName || `${this.name}-dl`

      debug('Creating dead letter Queue', opts.deadLetterQueueName)
      const deadLetterQueue = new Queue(opts.deadLetterQueueName, { isDeadLetterQueue: true })
      this.deadLetterQueue = deadLetterQueue

      // set redrive policy on origin queue
      createParams.Attributes.RedrivePolicy = `{"maxReceiveCount":"5", "deadLetterTargetArn":"${config.getSqsArnPrefix()}${deadLetterQueue.realName}"}`

      deadLetterQueue.on('ready', () => {
        resolve()
      })
    } else {
      resolve()
    }
  }).then(() =>
      new Promise((resolve, reject) => {
        clients.sqs.createQueue(createParams, (err, data) => {
          if (err) {
            this.emit('error', `Error creating queue ${this.realName}`, err)
            reject(err)
          } else {
            resolve(data)
          }
        })
      })
  )
}

/**
 * Register a consumer handler on a queue.
 *
 * @param {Function} consumerHandler
 * @param {Object} opts - @see {Consumer}
 * @returns {Consumer}
 */
Queue.prototype.onMessage = function (consumerHandler, opts) {
  return new Consumer(this, consumerHandler, opts)
}

module.exports = Queue
