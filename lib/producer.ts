import * as Bluebird from 'bluebird'
import { SQS, SNS } from 'aws-sdk'

import Queue from './queue'
import Topic from './topic'

class Producer {
  sqs: SQS
  sns: SNS

  constructor({ sqs, sns }: { sqs: SQS; sns: SNS }) {
    this.sqs = sqs
    this.sns = sns
  }

  /**
   * Send message to topic.
   */
  async sendTopic<T = any>(topic: Topic, message: T): Promise<SNS.Types.PublishResponse> {
    const metaAttachedMessage = Object.assign(
      {
        _meta: { topicName: topic.name },
      },
      message,
    )
    const encodedMessage = JSON.stringify(metaAttachedMessage)
    return new Bluebird(resolve => {
      if (topic.isReady) {
        resolve()
      } else {
        topic.on('ready', () => resolve())
      }
    })
      .timeout(2000)
      .then(() => {
        return new Promise((resolve, reject) => {
          this.sns.publish(
            {
              TopicArn: topic.arn,
              Message: encodedMessage,
            },
            (err, result) => {
              err ? reject(err) : resolve(result)
            },
          )
        })
      })
  }

  /**
   * Send message to queue
   */
  async sendQueue<T = any>(
    queue: Queue,
    message: T,
    opts?: { DelaySeconds?: number },
  ): Promise<SQS.Types.SendMessageResult> {
    const metaAttachedMessage = Object.assign({ _meta: {} }, message)
    const encodedMessage = JSON.stringify(metaAttachedMessage)
    return new Bluebird(resolve => {
      if (queue.isReady) {
        resolve()
      } else {
        queue.on('ready', () => resolve())
      }
    })
      .timeout(2000)
      .then(() => {
        return new Promise((resolve, reject) => {
          this.sqs.sendMessage(
            {
              ...opts,
              QueueUrl: queue.queueUrl,
              MessageBody: encodedMessage,
            },
            (err, result) => {
              err ? reject(err) : resolve(result)
            },
          )
        })
      })
  }
}

export default Producer
