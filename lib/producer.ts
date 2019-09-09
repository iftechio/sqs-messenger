import * as Bluebird from 'bluebird'

import { QueueClient, TopicClient, PublishResponse, SendMessageResult } from './client'
import Queue from './queue'
import Topic from './topic'

class Producer {
  queueClient: QueueClient
  topicClient: TopicClient

  constructor({
    queueClient,
    topicClient,
  }: {
    queueClient: QueueClient
    topicClient: TopicClient
  }) {
    this.queueClient = queueClient
    this.topicClient = topicClient
  }

  /**
   * Send message to topic.
   */
  async sendTopic<T extends object = any>(topic: Topic, message: T): Promise<PublishResponse> {
    const metaAttachedMessage = {
      _meta: { topicName: topic.name },
      ...(message as object),
    }
    const encodedMessage = JSON.stringify(metaAttachedMessage)
    return new Bluebird(resolve => {
      if (topic.isReady) {
        resolve()
      } else {
        topic.on('ready', () => resolve())
      }
    })
      .timeout(2000, `topic ${topic.name} is not ready within 2000ms`)
      .then(() => {
        return new Promise((resolve, reject) => {
          this.topicClient.publish(
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
  async sendQueue<T extends object = any>(
    queue: Queue,
    message: T,
    opts?: { DelaySeconds?: number },
  ): Promise<SendMessageResult> {
    const metaAttachedMessage = { _meta: {}, ...(message as object) }
    const encodedMessage = JSON.stringify(metaAttachedMessage)
    return new Bluebird(resolve => {
      if (queue.isReady) {
        resolve()
      } else {
        queue.on('ready', () => resolve())
      }
    })
      .timeout(2000, `queue ${queue.name} is not ready within 2000ms`)
      .then(() => {
        return new Promise((resolve, reject) => {
          this.queueClient.sendMessage(
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
