import * as Debug from 'debug'
import { EventEmitter } from 'events'

import { Client } from './client'
import Config from './config'
import Queue from './queue'

const debug = Debug('sqs-messenger:topic')

class Topic extends EventEmitter {
  isReady: boolean
  name: string
  realName: string
  Locator: string
  client: Client

  constructor(client: Client, name: string, config: Config) {
    super()
    this.client = client
    this.name = name
    this.realName = config.resourceNamePrefix + name
    this.isReady = false

    debug(`Create topic ${this.name}`)
    this._createTopic()
      .then(data => {
        debug('topic created %j', data)
        this.Locator = data.Locator || ''
        this.isReady = true
        this.emit('ready')
      })
      .catch(err => {
        this.emit('error', err)
      })
  }

  async _createTopic() {
    return new Promise<{ Locator?: string }>((resolve, reject) => {
      const createParams = { TopicName: this.realName }
      this.client
        .createTopic(createParams)
        .then(data => resolve(data))
        .catch(err => {
          // MNS Error
          if (err.name === 'TopicAlreadyExist') {
            console.warn(`Topic [${this.realName}] already exists`)
            resolve({ Locator: createParams.TopicName })
            return
          }
          reject(err)
        })
    })
  }

  /**
   * Subscribe queue to topic, queue must be declared already.
   */
  async subscribe(queue: Queue): Promise<void> {
    if (!this.isReady) {
      await new Promise(resolve => {
        this.on('ready', () => resolve())
      })
    }

    const data = await new Promise<{ SubscribeLocator?: string }>((resolve, reject) => {
      this.client
        .subscribe({
          TopicLocator: this.Locator,
          Protocol: 'sqs',
          Endpoint: queue.arn,
          QueueLocator: queue.locator,
        })
        .then(data2 => {
          debug(
            `Succeed subscribing ${queue.name}(${queue.realName}) to ${this.name}(${this.realName})`,
          )
          resolve(data2)
        })
        .catch(err => {
          debug(
            `Error subscribing ${queue.name}(${queue.realName}) to ${this.name}(${this.realName})`,
          )
          reject(err)
        })
    })

    return this.client.setSubscriptionAttributes({
      SubscribeLocator: data.SubscribeLocator!,
      AttributeName: 'RawMessageDelivery',
      AttributeValue: 'true',
    })
  }
}

export default Topic
