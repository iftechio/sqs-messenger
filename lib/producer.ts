import * as Promise from 'bluebird'
import { SQS, SNS } from 'aws-sdk'

class Producer {
  sqs: SQS
  sns: SNS

  constructor(sqs: SQS, sns: SNS) {
    this.sqs = sqs
    this.sns = sns
  }

  /**
   * Send message to topic.
   * @param {Topic} topic
   * @param {Object} message
   * @returns {Promise}
   */
  sendTopic(topic, message: any) {
    const encodedMessage = JSON.stringify(message)
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
  sendQueue(queue, message: any, options?) {
    const encodedMessage = JSON.stringify(message)
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
