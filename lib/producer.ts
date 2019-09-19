import * as Bluebird from 'bluebird'

import { Client } from './client'
import Queue from './queue'
import Topic from './topic'

class Producer {
  client: Client

  constructor(client: Client) {
    this.client = client
  }

  /**
   * Send message to topic.
   */
  async sendTopic<T extends object = any>(
    topic: Topic,
    message: T,
  ): Promise<{ MessageId?: string }> {
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
        return this.client.publish({
          Locator: topic.Locator,
          Message: encodedMessage,
        })
      })
  }

  /**
   * Send message to queue
   */
  async sendQueue<T extends object = any>(
    queue: Queue,
    message: T,
    opts?: { DelaySeconds?: number; Priority?: number },
  ): Promise<{
    MessageId?: string
    MD5OfMessageBody?: string
  }> {
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
        return this.client.sendMessage({
          ...opts,
          Locator: queue.locator,
          MessageBody: encodedMessage,
        })
      })
  }
}

export default Producer
