import * as Debug from 'debug'
import { EventEmitter } from 'events'

import { TopicClient, SubscribeResponse } from './client'
import Config from './config'
import Queue from './queue'

const debug = Debug('sqs-messenger:topic')

class Topic extends EventEmitter {
  isReady: boolean
  name: string
  realName: string
  arn: string
  client: TopicClient

  constructor(topicClient: TopicClient, name: string, config: Config) {
    super()
    this.client = topicClient
    this.name = name
    this.realName = config.resourceNamePrefix + name
    this.isReady = false

    debug(`Create topic ${this.name}`)
    this.client.createTopic({ Name: this.realName }, (err, data) => {
      if (err) {
        this.emit('error', err)
      } else {
        debug('topic created %j', data)
        this.arn = data.TopicArn || ''
        this.isReady = true
        this.emit('ready')
      }
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

    const data = await new Promise<SubscribeResponse>((resolve, reject) => {
      this.client.subscribe(
        {
          Protocol: 'sqs',
          TopicArn: this.arn,
          Endpoint: queue.arn,
        },
        (err, data2) => {
          if (err) {
            debug(
              `Error subscribing ${queue.name}(${queue.realName}) to ${this.name}(${
                this.realName
              })`,
            )
            reject(err)
          } else {
            debug(
              `Succeed subscribing ${queue.name}(${queue.realName}) to ${this.name}(${
                this.realName
              })`,
            )
            resolve(data2)
          }
        },
      )
    })

    return new Promise<void>((resolve, reject) => {
      this.client.setSubscriptionAttributes(
        {
          SubscriptionArn: data.SubscriptionArn!,
          AttributeName: 'RawMessageDelivery',
          AttributeValue: 'true',
        },
        err => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        },
      )
    })
  }
}

export default Topic
