import * as Debug from 'debug'
import * as Bluebird from 'bluebird'
import { EventEmitter } from 'events'

import { Client } from './client'
import Consumer from './consumer'
import Config from './config'

const debug = Debug('sqs-messenger:queue')

class Queue extends EventEmitter {
  client: Client
  name: string
  opts: {
    withDeadLetter: boolean
    visibilityTimeout: number
    maximumMessageSize: number
    isDeadLetterQueue: boolean
    maxReceiveCount: number
    delaySeconds: number
    messageRetentionPeriod: number
    pollingWaitSeconds: number
    loggingEnabled: boolean
  }
  realName: string
  arn: string
  isReady: boolean
  consumers: Consumer[]
  locator: string
  deadLetterQueue: Queue
  config: Config

  constructor(
    client: Client,
    name: string,
    opts: {
      withDeadLetter?: boolean
      visibilityTimeout?: number
      maximumMessageSize?: number
      isDeadLetterQueue?: boolean
      maxReceiveCount?: number
      delaySeconds?: number
      messageRetentionPeriod?: number
      pollingWaitSeconds?: number
      loggingEnabled?: boolean
    },
    config: Config,
  ) {
    super()
    this.client = client
    this.opts = {
      withDeadLetter: typeof opts.withDeadLetter === 'boolean' ? opts.withDeadLetter : false,
      isDeadLetterQueue:
        typeof opts.isDeadLetterQueue === 'boolean' ? opts.isDeadLetterQueue : false,
      visibilityTimeout: opts.visibilityTimeout || 30,
      maximumMessageSize: opts.maximumMessageSize || 65536,
      maxReceiveCount: opts.maxReceiveCount || 5,
      delaySeconds: opts.delaySeconds || 0,
      messageRetentionPeriod: opts.messageRetentionPeriod || 345600,
      pollingWaitSeconds: opts.pollingWaitSeconds || 0,
      loggingEnabled: typeof opts.loggingEnabled === 'boolean' ? opts.loggingEnabled : false,
    }
    this.name = name
    this.realName = config.resourceNamePrefix + name
    this.arn = config.sqsArnPrefix + this.realName
    this.isReady = false
    this.consumers = []
    this.config = config

    this._createQueue().then(
      data => {
        debug('Queue created', data)
        this.locator = data.Locator!
        this.isReady = true
        this.emit('ready')
      },
      error => this.emit('error', error),
    )
  }

  async _createQueue(): Promise<{ Locator?: string }> {
    debug(`Creating queue ${this.realName}`)
    const opts = this.opts
    const createParams: {
      QueueName: string
      Attributes?: {
        MaximumMessageSize: number
        VisibilityTimeout: number
        DelaySeconds: number
        Policy?: string
        RedrivePolicy?: string
        MessageRetentionPeriod?: number
        PollingWaitSeconds?: number
        LoggingEnabled?: boolean
      }
    } = opts.isDeadLetterQueue
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
            MessageRetentionPeriod: opts.messageRetentionPeriod,
            PollingWaitSeconds: opts.pollingWaitSeconds,
            LoggingEnabled: opts.loggingEnabled,
          },
        }

    await new Promise(resolve => {
      if (opts.withDeadLetter) {
        const deadLetterQueueName = `${this.name}-dl`

        debug('Creating dead letter Queue', deadLetterQueueName)
        const deadLetterQueue = new Queue(
          this.client,
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
    return new Promise<{ Locator?: string }>((resolve, reject) => {
      this.client
        .createQueue(createParams)
        .then(data => resolve(data))
        .catch(err => {
          // SQS Error
          if (err.name === 'QueueAlreadyExists') {
            console.warn(`Queue [${this.realName}] already exists`, err.stack)
            // ignore QueueAlreadyExists error
            resolve({ Locator: this.config.queueUrlPrefix + createParams.QueueName })
            return
          }
          // MNS Error
          if (err.name === 'QueueAlreadyExist') {
            console.warn(`Queue [${this.realName}] already exists`, err.stack)
            // ignore MNSQueueAlreadyExistErr error
            resolve({ Locator: createParams.QueueName })
            return
          }
          reject(err)
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
