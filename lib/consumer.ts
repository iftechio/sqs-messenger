import * as Debug from 'debug'
import * as Bluebird from 'bluebird'
import { EventEmitter } from 'events'
import * as MNS from '@ruguoapp/mns-node-sdk'

import Queue from './queue'

const debug = Debug('sqs-messenger:consumer')

class Consumer<T = any> extends EventEmitter {
  queue: Queue
  running: boolean
  batchSize: number
  visibilityTimeout: number
  waitSeconds: number
  batchHandle: boolean
  handler: (message: T | T[], callback: (err?: Error) => void) => void
  processingMessagesPromise?: Promise<void>

  constructor(
    queue: Queue,
    handler: (message: T | T[], callback: (err?: Error) => void) => void,
    opts: {
      batchSize?: number
      visibilityTimeout?: number
      batchHandle?: boolean
      waitSeconds?: number
    } = {},
  ) {
    super()
    this.queue = queue
    this.batchSize = opts.batchSize || 10
    this.visibilityTimeout = opts.visibilityTimeout || queue.opts.VisibilityTimeout || 30
    this.batchHandle = !!opts.batchHandle
    this.waitSeconds = opts.waitSeconds || 20
    this.running = false
    this.handler = handler

    if (queue.isReady) {
      this.start()
    } else {
      queue.addListener('ready', () => this.start())
    }
  }

  /**
   * Fetch a batch of messages from queue, and dispatch to internal response handler.
   */
  _pull(): void {
    if (this.running) {
      debug('Polling for messages')
      this.queue.mns
        .batchReceiveMessage(this.queue.name, this.batchSize, this.waitSeconds)
        .then(messages => {
          debug('Response received', messages)
          if (messages && messages.length) {
            debug('Handle messages', messages.length)
            this.processingMessagesPromise = this._processMessage(messages)
            this.processingMessagesPromise
              .then(() => {
                this._pull()
              })
              .catch((err2: Error) => {
                err2.message = `Consumer[${this.queue.name}] processingMessages error: ${
                  err2.message
                  }`
                this.emit('error', err2)
                this._pull()
              })
          } else {
            this._pull()
          }
        })
        .catch(err => {
          if (err.name === 'MNSMessageNotExistErr') {
            this._pull()
          } else {
            err.message = `Error receiving sqs message: ${err.message}`
            this.emit('error', err)
          }
        })
    }
  }

  /**
   * Call consumer handler, this function never reject, to make the polling loop running forever.
   */
  async _processMessage(messages: MNS.Types.ReceiveMessageResponse[]): Promise<void> {
    debug('Processing message, %o', messages)
    const decodedMessages = messages.map(
      message => message.MessageBody && JSON.parse(message.MessageBody),
    )

    return (this.batchHandle
      ? new Bluebird<void>((resolve, reject) => {
        this.handler(decodedMessages, err => {
          if (err) {
            reject(err)
          } else {
            resolve(this._deleteMessageBatch(messages))
          }
        })
      })
      : Bluebird.map(decodedMessages, (decodedMessage, i) => {
        return new Promise((resolve, reject) => {
          this.handler(decodedMessage, err => {
            if (err) {
              reject(err)
            } else {
              resolve(this._deleteMessage(messages[i]))
            }
          })
        })
      })
    )
      .timeout(this.visibilityTimeout * 1000)
      .catch((err: Error) => {
        // catch error
        if (err instanceof Bluebird.TimeoutError) {
          debug('Message handler timeout, %o', messages)
        } else {
          debug('Message handler reject', err)
        }
        err.message = `Consumer[${this.queue.name}] handler error: ${err.message}`
        this.emit('error', err)
      })
  }

  /**
   * Delete message from queue if it's handled correctly.
   */
  async _deleteMessage(message: MNS.Types.ReceiveMessageResponse): Promise<void> {
    debug('Deleting message ', message.MessageId)
    return new Promise<void>((resolve, reject) => {
      this.queue.mns
        .deleteMessage(this.queue.name, message.ReceiptHandle)
        .then(resolve)
        .catch(reject)
    })
  }

  async _deleteMessageBatch(messages: MNS.Types.ReceiveMessageResponse[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.queue.mns
        .batchDeleteMessage(this.queue.name, messages.map(message => message.ReceiptHandle))
        .then(data => {
          if (data) {
            reject(data)
          }
          resolve()
        })
        .catch(reject)
    })
  }

  /**
   * Start the fetch loop.
   */
  start(): void {
    this.running = true
    this._pull()
  }

  /**
   * Stop the fetch loop.
   */
  stop(): void {
    this.running = false
  }

  /**
   * Graceful shutdown
   */
  async shutdown(timeout: number): Promise<void> {
    this.stop()
    if (!timeout || !this.processingMessagesPromise) {
      return
    }
    debug('Waiting for consumer shutdown', timeout)
    return Bluebird.resolve(this.processingMessagesPromise)
      .timeout(timeout, 'shutdown timeout')
      .catch(err => {
        this.emit('error', err)
      })
  }
}

export default Consumer
