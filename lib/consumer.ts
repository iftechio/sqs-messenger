import * as Debug from 'debug'
import * as Bluebird from 'bluebird'
import { EventEmitter } from 'events'

import { ReceiveMessageResult, Message } from './client'
import Queue from './queue'

const debug = Debug('sqs-messenger:consumer')

class Consumer<T = any> extends EventEmitter {
  queue: Queue
  running: boolean
  batchSize: number
  visibilityTimeout: number
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
    } = {},
  ) {
    super()
    this.queue = queue
    this.batchSize = opts.batchSize || 10
    this.visibilityTimeout = opts.visibilityTimeout || parseInt(queue.opts.visibilityTimeout) || 30
    this.batchHandle = !!opts.batchHandle
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
      this.queue.client.receiveMessage(
        {
          QueueUrl: this.queue.queueUrl,
          MaxNumberOfMessages: this.batchSize,
          WaitTimeSeconds: 20, // max time long polling
          VisibilityTimeout: this.visibilityTimeout,
        },
        (err, data) => {
          this._handleSqsResponse(err, data)
        },
      )
    }
  }

  /**
   * Handler response which contains a batch of messages, dispatch then to consumer handler.
   */
  _handleSqsResponse(err: Error, response: ReceiveMessageResult): void {
    if (err) {
      err.message = `Error receiving sqs message: ${err.message}`
      this.emit('error', err)
    }
    debug('Response received', response)
    if (response && response.Messages && response.Messages.length) {
      debug('Handle messages', response.Messages.length)
      this.processingMessagesPromise = this._processMessage(response.Messages)
      this.processingMessagesPromise
        .then(() => {
          this._pull()
        })
        .catch((err2: Error) => {
          err2.message = `Consumer[${this.queue.name}] processingMessages error: ${err2.message}`
          this.emit('error', err2)
          this._pull()
        })
    } else {
      this._pull()
    }
  }

  /**
   * Call consumer handler, this function never reject, to make the polling loop running forever.
   */
  async _processMessage(messages: Message[]): Promise<void> {
    debug('Processing message, %o', messages)
    const decodedMessages = messages.map(message => message.Body && JSON.parse(message.Body))

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
  async _deleteMessage(message: Message): Promise<void> {
    const deleteParams = {
      QueueUrl: this.queue.queueUrl,
      ReceiptHandle: message.ReceiptHandle!,
    }

    debug('Deleting message ', message.MessageId)
    return new Promise<void>((resolve, reject) => {
      this.queue.client.deleteMessage(deleteParams, err => {
        err ? reject(err) : resolve()
      })
    })
  }

  async _deleteMessageBatch(messages: Message[]): Promise<void> {
    const params = {
      QueueUrl: this.queue.queueUrl,
      Entries: messages.map((message, i) => ({
        Id: i.toString(),
        ReceiptHandle: message.ReceiptHandle!,
      })),
    }

    return new Promise<void>((resolve, reject) => {
      this.queue.client.deleteMessageBatch(params, err => {
        err ? reject(err) : resolve()
      })
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
