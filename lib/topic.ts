import * as Debug from 'debug'
import { EventEmitter } from 'events'
import * as MNS from '@ruguoapp/mns-node-sdk'

import Queue from './queue'

const debug = Debug('sqs-messenger:topic')

class Topic extends EventEmitter {
  isReady: boolean
  name: string
  mns: MNS.Client
  opts: {
    MaximumMessageSize: number
    LoggingEnabled: boolean
  }

  constructor(
    mns: MNS.Client,
    name: string,
    opts: {
      MaximumMessageSize?: number
      LoggingEnabled?: boolean
    } = {},
  ) {
    super()
    this.mns = mns
    this.name = name
    this.isReady = false
    this.opts = {
      MaximumMessageSize: opts.MaximumMessageSize || 65536,
      LoggingEnabled: opts.LoggingEnabled || false
    }


    debug(`Create topic ${this.name}`)
    this.mns
      .createTopic(this.name, this.opts)
      .then(data => {
        debug('topic created %j', data)
        this.isReady = true
        this.emit('ready')
      })
      .catch(err => this.emit('error', err))
  }

  /**
   * Subscribe queue to topic, queue must be declared already.
   */
  async subscribe(queue: Queue, subscriptionName: string): Promise<MNS.Types.SubscribeResponse> {
    if (!this.isReady) {
      await new Promise(resolve => {
        this.on('ready', () => resolve())
      })
    }

    return new Promise<MNS.Types.SubscribeResponse>((resolve, reject) => {
      return this.mns
        .subscribe(this.name, subscriptionName, {
          Endpoint: queue.queueUrl,
        })
        .then(data2 => {
          debug(`Succeed subscribing ${subscriptionName}`)
          resolve(data2)
        })
        .catch(err => {
          debug(`Error subscribing ${subscriptionName}`)
          reject(err)
        })
    })
  }
}

export default Topic
