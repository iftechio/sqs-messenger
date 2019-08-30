import * as Bluebird from 'bluebird'
import * as MNS from '@ruguoapp/mns-node-sdk'

import Queue from './queue'
import Topic from './topic'

class Producer {
  mns: MNS.Client

  constructor(mns: MNS.Client) {
    this.mns = mns
  }

  /**
   * Send message to topic.
   */
  async sendTopic<T extends object = any>(
    topic: Topic,
    message: T,
    opts?: {
      MessageTag?: string | undefined
      MessageAttributes?: any
    },
  ): Promise<MNS.Types.PublishMessageResponse> {
    const metaAttachedMessage = {
      _meta: { topicName: topic.name },
      ...(message as object),
    }
    const encodedMessage = JSON.stringify(metaAttachedMessage)
    return new Bluebird(resolve => {
      if (topic.isReady) {
        resolve({ abc: 1 })
      } else {
        topic.on('ready', () => resolve({ abc: 1 }))
      }
    })
      .timeout(2000, `topic ${topic.name} is not ready within 2000ms`)
      .then(() => {
        return new Promise((resolve, reject) => {
          this.mns
            .publishMessage(topic.name, {
              MessageBody: encodedMessage,
              ...opts,
            })
            .then(result => resolve(result))
            .catch(err => reject(err))
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
  ): Promise<MNS.Types.SendMessageResponse> {
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
          this.mns
            .sendMessage(queue.name, {
              MessageBody: encodedMessage,
              ...opts,
            })
            .then(result => resolve(result))
            .catch(err => reject(err))
        })
      })
  }
}

export default Producer
