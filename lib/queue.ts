const debug = require('debug')('sqs-messenger:queue')
import * as Promise from 'bluebird'
import { EventEmitter } from 'events'
import * as util from 'util'

import * as clients from './clients'
import * as config from './config'
import Consumer from './consumer'


class Queue extends EventEmitter {
  opts: any
  name: string
  realName: string
  arn: string
  isReady: boolean
  consumers: Consumer[]
  queueUrl: string
  deadLetterQueue: Queue

  /**
   * Construct an SQS queue.
   * @param {String} name
   * @param {Boolean} [opts.withDeadLetter=false]
   * @param {String} [opts.deadLetterQueueName]
   * @param {Number} [opts.visibilityTimeout=30]
   * @param {Number} [opts.maximumMessageSize=262144] - 256KB
   * @param {Number} [opts.isDeadLetterQueue=false]
   * @param {Number} [opts.maxReceiveCount=5]
   */
  constructor(name, opts: any = {}) {
    super()
    this.opts = {
      withDeadLetter: (typeof opts.withDeadLetter === 'boolean') ? opts.withDeadLetter : false,
      visibilityTimeout: (opts.visibilityTimeout || 30).toString(),
      maximumMessageSize: (opts.maximumMessageSize || 262144).toString(),
      isDeadLetterQueue: (typeof opts.isDeadLetterQueue === 'boolean') ? opts.isDeadLetterQueue : false,
      maxReceiveCount: opts.maxReceiveCount || 5,
    }
    this.name = name
    this.realName = config.getResourceNamePrefix() + name
    this.arn = config.getSqsArnPrefix() + this.realName
    this.isReady = false
    this.consumers = []

    this._createQueue().then(data => {
      debug('Queue created', data)
      this.queueUrl = data.QueueUrl
      this.isReady = true
      this.emit('ready')
    }, error => this.emit('error', error))
  }

  _createQueue() {
    debug(`Creating queue ${this.realName}`)
    const opts = this.opts
    const createParams: any = opts.isDeadLetterQueue ? { QueueName: this.realName } : {
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
        createParams.Attributes.RedrivePolicy = `{"maxReceiveCount":"${opts.maxReceiveCount}", "deadLetterTargetArn":"${config.getSqsArnPrefix()}${deadLetterQueue.realName}"}`

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
            if (err.name === 'QueueAlreadyExists') {
              console.warn('QueueAlreadyExists', err.stack)
              // ignore QueueAlreadyExists error
              resolve({ QueueUrl: config.getQueueUrlPrefix() + createParams.QueueName })
              return
            }
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
  onMessage(consumerHandler, opts?) {
    const consumer = new Consumer(this, consumerHandler, opts)
    this.consumers.push(consumer)
    return consumer
  }

  /**
   * Gracefully shutdown each consumer within `timeout`
   *
   * @param {Number} timeout
   * @returns {Promise}
   */
  shutdown(timeout) {
    return Promise.map(this.consumers, (consumer) => {
      return consumer.shutdown(timeout)
    })
  }
}

export default Queue
