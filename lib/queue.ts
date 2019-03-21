import * as Debug from 'debug'
import * as Bluebird from 'bluebird'
import { EventEmitter } from 'events'
import { SQS } from 'aws-sdk'

import Consumer from './consumer'
import Config from './config'

const debug = Debug('sqs-messenger:queue')

class Queue extends EventEmitter {
  sqs: SQS
  name: string
  opts: {
    withDeadLetter: boolean
    visibilityTimeout: string
    maximumMessageSize: string
    isDeadLetterQueue: boolean
    maxReceiveCount: number
    delaySeconds: string
  }
  realName: string
  arn: string
  isReady: boolean
  consumers: Consumer[]
  queueUrl: string
  deadLetterQueue: Queue
  config: Config
  preexisting: boolean

  constructor(
    sqs: SQS,
    name: string,
    opts: {
      withDeadLetter?: boolean
      visibilityTimeout?: number
      maximumMessageSize?: number
      isDeadLetterQueue?: boolean
      maxReceiveCount?: number
      delaySeconds?: number
    },
    config: Config,
  ) {
    super()
    this.sqs = sqs
    this.opts = {
      withDeadLetter: typeof opts.withDeadLetter === 'boolean' ? opts.withDeadLetter : false,
      visibilityTimeout: (opts.visibilityTimeout || 30).toString(),
      maximumMessageSize: (opts.maximumMessageSize || 262144).toString(),
      isDeadLetterQueue:
        typeof opts.isDeadLetterQueue === 'boolean' ? opts.isDeadLetterQueue : false,
      maxReceiveCount: opts.maxReceiveCount || 5,
      delaySeconds: (opts.delaySeconds || 0).toString(),
    }
    this.name = name
    this.realName = config.resourceNamePrefix + name
    this.arn = config.sqsArnPrefix + this.realName
    this.isReady = false
    this.consumers = []
    this.config = config
    this.queueUrl = this.config.queueUrlPrefix + this.realName

    this.sqs.getQueueAttributes({ QueueUrl: this.queueUrl }, err => {
      if (!err) {
        debug('Queue exists', this.realName)
        this.preexisting = true
        this.isReady = true
        this.emit('ready')
        return
      }
      if (err.code === 'AWS.SimpleQueueService.NonExistentQueue') {
        this._createQueue().then(
          data => {
            debug('Queue created %j', data)
            this.isReady = true
            this.emit('ready')
          },
          error => this.emit('error', error),
        )
      } else {
        this.emit('error', err)
      }
    })
  }

  async _createQueue(): Promise<{ QueueUrl?: string }> {
    debug(`Creating queue ${this.realName}`)
    const opts = this.opts
    const createParams: SQS.Types.CreateQueueRequest = opts.isDeadLetterQueue
      ? {
          QueueName: this.realName,
        }
      : {
          QueueName: this.realName,
          Attributes: {
            MaximumMessageSize: opts.maximumMessageSize,
            VisibilityTimeout: opts.visibilityTimeout,
            DelaySeconds: opts.delaySeconds,
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

    await new Promise(resolve => {
      if (opts.withDeadLetter) {
        const deadLetterQueueName = `${this.name}-dl`

        debug('Creating dead letter Queue', deadLetterQueueName)
        const deadLetterQueue = new Queue(
          this.sqs,
          deadLetterQueueName,
          { isDeadLetterQueue: true },
          this.config,
        )
        this.deadLetterQueue = deadLetterQueue

        // set redrive policy on origin queue
        createParams.Attributes!.RedrivePolicy = `{"maxReceiveCount":"${
          opts.maxReceiveCount
        }", "deadLetterTargetArn":"${this.config.sqsArnPrefix}${deadLetterQueue.realName}"}`

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
            console.warn(`Queue [${this.realName}] already exists`, err.stack)
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
   */
  onMessage<T = any>(
    handler: (message: T | T[], callback: (err?: Error) => void) => void,
    opts?: {
      batchSize?: number
      visibilityTimeout?: number
      batchHandle?: boolean
    },
  ): Consumer<T> {
    const consumer = new Consumer<T>(this, handler, opts)
    this.consumers.push(consumer)
    return consumer
  }

  /**
   * Gracefully shutdown each consumer within `timeout`
   */
  async shutdown(timeout: number): Promise<void[]> {
    return Bluebird.map(this.consumers, consumer => {
      return consumer.shutdown(timeout)
    })
  }
}

export default Queue
