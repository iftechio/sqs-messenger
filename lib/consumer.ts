const debug = require('debug')('sqs-messenger:consumer')
import * as Promise from 'bluebird'
import { EventEmitter } from 'events'
import * as util from 'util'

import * as clients from './clients'
import * as jsonProtocol from './protocols/jsonProtocol'

class Consumer extends EventEmitter {
  queue: any
  running: boolean
  batchSize: number
  visibilityTimeout: number
  batchHandle: boolean
  protocol: any
  handler: any
  processingMessagesPromise: any

  /**
   * @param {Queue} queue
   * @param {Function} handler
   * @param {Number} [opts.batchSize=10]
   * @param {Number} [opts.visibilityTimeout=30]
   * @param {Boolean} [opts.batchHandle=false]
   * @param {Object} [opts.protocol=jsonProtocol]
 */
  constructor(queue, handler, opts: any = {}) {
    super()
    this.queue = queue
    this.batchSize = opts.batchSize || 10
    this.visibilityTimeout = opts.visibilityTimeout || 30
    this.batchHandle = !!opts.batchHandle
    this.protocol = opts.protocol || jsonProtocol
    this.running = false
    this.handler = handler
    this.processingMessagesPromise = null

    if (queue.isReady) {
      this.start()
    } else {
      queue.addListener('ready', () => this.start())
    }
  }

  /**
   * Fetch a batch of messages from queue, and dispatch to internal response handler.
   */
  _poll() {
    const receiveParams = {
      QueueUrl: this.queue.queueUrl,
      MaxNumberOfMessages: this.batchSize,
      WaitTimeSeconds: 20, // max time long polling
      VisibilityTimeout: this.visibilityTimeout,
    }

    if (this.running) {
      debug('Polling for messages')
      clients.sqs.receiveMessage(receiveParams, (err, data) => {
        this._handleSqsResponse(err, data)
      })
    }
  }

  /**
   * Handler response which contains a batch of messages, dispatch then to consumer handler.
   */
  _handleSqsResponse(err, response) {
    if (err) {
      this.emit('error', 'Error receiving sqs message', err)
    }
    debug('Response received', response)
    if (response && response.Messages && response.Messages.length) {
      debug('Handle messages', response.Messages.length)
      this.processingMessagesPromise = this._processMessage(response.Messages)
      this.processingMessagesPromise.then(() => this._poll())
    } else {
      this._poll()
    }
  }

  /**
   * Call consumer handler, this function never reject, to make the polling loop running forever.
   */
  _processMessage(messages) {
    debug('Processing message, %o', messages)
    const decodedMessages = messages.map(message => this.protocol.decode(message))

    return (this.batchHandle ?
      new Promise((resolve, reject) => {
        this.handler.call(undefined, decodedMessages, err => {
          if (err) {
            reject(err)
          } else {
            resolve(this._deleteMessageBatch(messages))
          }
        })
      }) :
      Promise.all(
        decodedMessages.map((decodedMessage, i) =>
          new Promise((resolve, reject) => {
            this.handler.call(undefined, decodedMessage, err => {
              if (err) {
                reject(err)
              } else {
                resolve(this._deleteMessage(messages[i]))
              }
            })
          })
        )
      )
    ).timeout(this.visibilityTimeout * 1000).then(null, err => {
      // catch error
      if (err instanceof Promise.TimeoutError) {
        debug('Message handler timeout, %o', messages)
      } else {
        debug('Message handler reject', err)
      }
      this.emit('error', `Consumer[${this.queue.name}] handler error`, err)
    })
  }

  /**
   * Delete message from queue if it's handled correctly.
  */
  _deleteMessage(message) {
    const deleteParams = {
      QueueUrl: this.queue.queueUrl,
      ReceiptHandle: message.ReceiptHandle,
    }

    debug('Deleting message ', message.MessageId)
    return new Promise((resolve, reject) => {
      clients.sqs.deleteMessage(deleteParams, err => {
        if (err) return reject(err)
        return resolve()
      })
    })
  }

  _deleteMessageBatch(messages) {
    const params = {
      QueueUrl: this.queue.queueUrl,
      Entries: messages.map((message, i) => ({ Id: i.toString(), ReceiptHandle: message.ReceiptHandle }))
    }

    return new Promise((resolve, reject) => {
      clients.sqs.deleteMessageBatch(params, err => {
        if (err) return reject(err)
        return resolve()
      })
    })
  }

  /**
   * Start the fetch loop.
   */
  start() {
    this.running = true
    this._poll()
  }

  /**
   * Stop the fetch loop.
   */
  stop() {
    this.running = false
  }

  /**
   * Graceful shutdown
   */
  shutdown(timeout) {
    this.stop()
    if (!timeout || !this.processingMessagesPromise) {
      return Promise.resolve()
    }
    debug('Waiting for consumer shutdown', timeout)
    return this.processingMessagesPromise
      .timeout(timeout, 'shutdown timeout')
      .catch(err => this.emit('error', err))
  }
}

export default Consumer
