import * as Promise from 'bluebird'
import { SQS, SNS } from 'aws-sdk'

class Producer {
  sqs: SQS
  sns: SNS
  protocol: any

  constructor(sqs: SQS, sns: SNS, protocol) {
    this.sqs = sqs
    this.sns = sns
    this.protocol = protocol
  }

  /**
   * Send message to topic.
   * @param {Topic} topic
   * @param {Object} message
   * @returns {Promise}
   */
  sendTopic(topic, message) {
    const encodedMessage = this.protocol.encode(message)
    return new Promise((resolve) => {
      if (topic.isReady) {
        resolve()
      } else {
        topic.on('ready', () => resolve())
      }
    }).timeout(2000).then(() =>
      new Promise((resolve, reject) => {
        this.sns.publish({
          TopicArn: topic.arn,
          Message: encodedMessage,
        }, (err, result) => {
          if (err) reject(err)
          else resolve(result)
        })
      })
      )
  }

  /**
   * Send message to queue
   * @param {Queue} queue
   * @param {Object} message
   * @param {Object} options
   * @param {Number} options.DelaySeconds - 0 to 900
   * @returns {Promise}
   */
  sendQueue(queue, message, options?) {
    const encodedMessage = this.protocol.encode(message)
    return new Promise((resolve) => {
      if (queue.isReady) {
        resolve()
      } else {
        queue.on('ready', () => resolve())
      }
    }).timeout(2000).then(() =>
      new Promise((resolve, reject) => {
        this.sqs.sendMessage(Object.assign({
          QueueUrl: queue.queueUrl,
          MessageBody: encodedMessage,
        }, options), (err, result) => {
          if (err) reject(err)
          else resolve(result)
        })
      })
      )
  }
}

export default Producer
