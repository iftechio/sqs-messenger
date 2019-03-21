import * as Debug from 'debug'
import { EventEmitter } from 'events'
import { SNS } from 'aws-sdk'

import Config from './config'
import Queue from './queue'

const debug = Debug('sqs-messenger:topic')

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
    this.arn = config.snsArnPrefix + this.realName
    this.isReady = false

    this.sns.getTopicAttributes({ TopicArn: this.arn }, err => {
      if (err) {
        if (err.code === 'NotFound') {
          this._createTopic()
        } else {
          this.emit('error', err)
        }
      } else {
        debug('topic exists', this.realName)
        this.isReady = true
        this.emit('ready')
      }
    })
  }

  _createTopic() {
    debug(`Create topic ${this.name}`)
    this.sns.createTopic({ Name: this.realName }, (err, data) => {
      if (err) {
        this.emit('error', err)
      } else {
        debug('topic created %j', data)
        this.isReady = true
        this.emit('ready')
      }
    })
  }

  /**
   * Subscribe queue to topic, queue must be declared already.
   */
  async subscribe(queue: Queue): Promise<void> {
    // 如果一个 queue 先前已经存在，我们认为它不需要重复订阅 topic 了
    if (queue.preexisting) {
      return
    }

    if (!this.isReady) {
      await new Promise(resolve => {
        this.on('ready', () => resolve())
      })
    }

    const data = await new Promise<SNS.Types.SubscribeResponse>((resolve, reject) => {
      this.sns.subscribe(
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
      this.sns.setSubscriptionAttributes(
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
