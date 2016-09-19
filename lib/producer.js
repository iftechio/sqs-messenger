const Promise = require('bluebird')
const clients = require('./clients')

function Producer(protocol) {
  this.protocol = protocol
}

/**
 * Send message to topic.
 * @param {Topic} topic
 * @param {Object} message
 * @returns {Promise}
 */
Producer.prototype.sendTopic = function (topic, message) {
  const encodedMessage = this.protocol.encode(message)
  return new Promise((resolve) => {
    if (topic.isReady) {
      resolve()
    } else {
      topic.on('ready', () => resolve())
    }
  }).timeout(2000).then(() =>
      new Promise((resolve, reject) => {
        clients.sns.publish({
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
 * @returns {Promise}
 */
Producer.prototype.sendQueue = function (queue, message) {
  const encodedMessage = this.protocol.encode(message)
  return new Promise((resolve) => {
    if (queue.isReady) {
      resolve()
    } else {
      queue.on('ready', () => resolve())
    }
  }).timeout(2000).then(() =>
      new Promise((resolve, reject) => {
        clients.sqs.sendMessage({
          QueueUrl: queue.queueUrl,
          MessageBody: encodedMessage,
        }, (err, result) => {
          if (err) reject(err)
          else resolve(result)
        })
      })
  )
}

module.exports = Producer
