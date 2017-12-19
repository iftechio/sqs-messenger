const debug = require('debug')('sqs-messenger:topic')
import { EventEmitter } from 'events'
import { SNS } from 'aws-sdk'

import Config from './config'
import Queue from './queue'

class Topic extends EventEmitter {
  isReady: boolean
  name: string
  realName: string
  arn: string
  sns: SNS

  constructor(sns: SNS, name: string, config: Config) {
    super()
    this.sns = sns
    this.name = name
    this.realName = config.resourceNamePrefix + name
    this.isReady = false

    debug(`Create topic ${this.name}`)
    this.sns.createTopic({ Name: this.realName }, (err, data) => {
      if (err) {
        this.emit('error', err)
      } else {
        debug('topic created', data)
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
      await new Promise((resolve) => {
        this.on('ready', () => resolve())
      })
    }

    const data = await new Promise<SNS.Types.SubscribeResponse>((resolve, reject) => {
      this.sns.subscribe({
        Protocol: 'sqs',
        TopicArn: this.arn,
        Endpoint: queue.arn,
      }, (err, data) => {
        if (err) {
          debug(`Error subscribing ${queue.name}(${queue.realName}) to ${this.name}(${this.realName})`)
          reject(err)
        } else {
          debug(`Succeed subscribing ${queue.name}(${queue.realName}) to ${this.name}(${this.realName})`)
          resolve(data)
        }
      })
    })

    return new Promise<void>((resolve, reject) => {
      this.sns.setSubscriptionAttributes({
        SubscriptionArn: data.SubscriptionArn!,
        AttributeName: 'RawMessageDelivery',
        AttributeValue: 'true',
      }, err => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }
}

export default Topic
