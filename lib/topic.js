const clients = require('./clients')
const Promise = require('bluebird')
const EventEmitter = require('events').EventEmitter
const util = require('util')
const debug = require('debug')('sqs-messenger:topic')

const config = require('./config')

function create(name) {
  debug(`Create topic ${name}`)
  return new Promise((resolve, reject) => {
    clients.sns.createTopic({ Name: name }, (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

function Topic(name) {
  this.name = name
  this.realName = config.getResourceNamePrefix() + name
  this.isReady = false

  create(this.realName).then(data => {
    debug('topic created', data)
    this.arn = data.TopicArn
    this.isReady = true
    this.emit('ready')
  }, error => this.emit('error', error))
}
util.inherits(Topic, EventEmitter)

/**
 * Subscribe queue to topic, queue must be declared already.
 * @param {Queue} queue
 */
Topic.prototype.subscribe = function (queue) {
  return Promise.resolve().then(() => {
    if (this.isReady) {
      return null
    }
    return new Promise((resolve) => {
      this.on('ready', () => resolve())
    })
  }).then(() =>
      new Promise((resolve, reject) => {
        clients.sns.subscribe({
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
  ).then((data) =>
      new Promise((resolve, reject) => {
        clients.sns.setSubscriptionAttributes({
          SubscriptionArn: data.SubscriptionArn,
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
  )
}

module.exports = Topic
