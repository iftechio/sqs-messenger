const debug = require('debug')('sqs-messenger:queue')
import * as bluebird from 'bluebird'
import { EventEmitter } from 'events'
import { SQS } from 'aws-sdk'

import Consumer from './consumer'
import Config from './config'

class Queue extends EventEmitter {
  sqs: SQS
  name: string
  opts: {
    withDeadLetter: boolean
    visibilityTimeout: string
    maximumMessageSize: string
    isDeadLetterQueue: boolean
    maxReceiveCount: number
  }
  realName: string
  arn: string
  isReady: boolean
  consumers: Consumer[]
  queueUrl: string
  deadLetterQueue: Queue
  config: Config

  constructor(sqs: SQS, name: string, opts: {
    withDeadLetter?: boolean
    visibilityTimeout?: number
    maximumMessageSize?: number
    isDeadLetterQueue?: boolean
    maxReceiveCount?: number
  } = {}, config: Config) {
    super()
    this.sqs = sqs
    this.opts = {
      withDeadLetter: (typeof opts.withDeadLetter === 'boolean') ? opts.withDeadLetter : false,
      visibilityTimeout: (opts.visibilityTimeout || 30).toString(),
      maximumMessageSize: (opts.maximumMessageSize || 262144).toString(),
      isDeadLetterQueue: (typeof opts.isDeadLetterQueue === 'boolean') ? opts.isDeadLetterQueue : false,
      maxReceiveCount: opts.maxReceiveCount || 5,
    }
    this.name = name
    this.realName = config.resourceNamePrefix + name
    this.arn = config.sqsArnPrefix + this.realName
    this.isReady = false
    this.consumers = []
    this.config = config

    this._createQueue().then(data => {
      debug('Queue created', data)
      this.queueUrl = data.QueueUrl!
      this.isReady = true
      this.emit('ready')
    }, error => this.emit('error', error))
  }

  async _createQueue(): Promise<SQS.Types.CreateQueueResult> {
    debug(`Creating queue ${this.realName}`)
    const opts = this.opts
    const createParams: SQS.Types.CreateQueueRequest = opts.isDeadLetterQueue
      ? {
        QueueName: this.realName,
      } : {
        QueueName: this.realName,
        Attributes: {
          MaximumMessageSize: opts.maximumMessageSize,
          VisibilityTimeout: opts.visibilityTimeout,
          Policy: `{
            "Version": "2012-10-17",
            "Id": "${this.config.sqsArnPrefix}${this.realName}/SQSDefaultPolicy",
            "Statement": [
              {
                "Sid": "1",
                "Effect": "Allow",
                "Principal": "*",
                "Action": "SQS:SendMessage",
                "Resource": "${this.config.sqsArnPrefix}${this.realName}"
              }
            ]
          }`.replace(/\s/g, ''),
        },
      }

    await new Promise((resolve, reject) => {
      if (opts.withDeadLetter) {
        const deadLetterQueueName = `${this.name}-dl`

        debug('Creating dead letter Queue', deadLetterQueueName)
        const deadLetterQueue = new Queue(this.sqs, deadLetterQueueName, { isDeadLetterQueue: true }, this.config)
        this.deadLetterQueue = deadLetterQueue

        // set redrive policy on origin queue
        createParams.Attributes!.RedrivePolicy = `{"maxReceiveCount":"${opts.maxReceiveCount}", "deadLetterTargetArn":"${this.config.sqsArnPrefix}${deadLetterQueue.realName}"}`

        deadLetterQueue.on('ready', () => {
          resolve()
        })
      } else {
        resolve()
      }
    })
    return new Promise<SQS.Types.CreateQueueResult>((resolve, reject) => {
      this.sqs.createQueue(createParams, (err, data) => {
        if (err) {
          if (err.name === 'QueueAlreadyExists') {
            console.warn('QueueAlreadyExists', err.stack)
            // ignore QueueAlreadyExists error
            resolve({ QueueUrl: this.config.queueUrlPrefix + createParams.QueueName })
            return
          }
          reject(err)
        } else {
          resolve(data)
        }
      })
    })
  }

  /**
   * Register a consumer handler on a queue.
   *
   * @param {Function} consumerHandler
   * @param {Object} opts - @see {Consumer}
   * @returns {Consumer}
   */
  onMessage<T = any>(consumerHandler: (message: T | T[], callback: (err?: Error) => void) => void, opts?) {
    const consumer = new Consumer(this, consumerHandler, opts)
    this.consumers.push(consumer)
    return consumer
  }

  /**
   * Gracefully shutdown each consumer within `timeout`
   */
  async shutdown(timeout): Promise<void> {
    return bluebird.map(this.consumers, (consumer) => {
      return consumer.shutdown(timeout)
    })
  }
}

export default Queue
