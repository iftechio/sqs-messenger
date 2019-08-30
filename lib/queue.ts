import * as Debug from 'debug'
import * as Bluebird from 'bluebird'
import { EventEmitter } from 'events'
import * as MNS from '@ruguoapp/mns-node-sdk'

import Consumer from './consumer'

const debug = Debug('sqs-messenger:queue')

class Queue extends EventEmitter {
  mns: MNS.Client
  name: string
  opts: {
    DelaySeconds: number
    MaximumMessageSize: number
    MessageRetentionPeriod: number
    VisibilityTimeout: number
    PollingWaitSeconds: number
    LoggingEnabled: boolean
  }
  isReady: boolean
  consumers: Consumer[]
  queueUrl: string

  constructor(
    mns: MNS.Client,
    name: string,
    opts: {
      delaySeconds?: number
      maximumMessageSize?: number
      messageRetentionPeriod?: number
      visibilityTimeout?: number
      pollingWaitSeconds?: number
      loggingEnabled?: boolean
    } = {},
  ) {
    super()
    this.mns = mns

    this.opts = {
      VisibilityTimeout: opts.visibilityTimeout || 30,
      MaximumMessageSize: opts.maximumMessageSize || 65536,
      MessageRetentionPeriod: opts.messageRetentionPeriod || 259200,
      DelaySeconds: opts.delaySeconds || 0,
      PollingWaitSeconds: opts.pollingWaitSeconds || 0,
      LoggingEnabled: opts.loggingEnabled || false,
    }
    this.name = name
    this.isReady = false
    this.consumers = []

    this._createQueue()
      .then(data => {
        debug('Queue created', data)
        this.queueUrl = data.Location
        this.isReady = true
        this.emit('ready')
      })
      .catch(error => this.emit('error', error))
  }

  async _createQueue(): Promise<MNS.Types.CreateQueueResponse> {
    debug(`Creating queue ${this.name}`)
    // return this.mns.createQueue(this.name, this.opts)

    return new Promise<MNS.Types.CreateQueueResponse>((resolve, reject) => {
      return this.mns
        .createQueue(this.name, this.opts)
        .then(data => resolve(data))
        .catch(err => reject(err))
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
