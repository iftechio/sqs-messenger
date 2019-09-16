import test from './_init'
import * as sinon from 'sinon'
import * as Bluebird from 'bluebird'

import Queue from '../lib/queue'
import Config from '../lib/config'
import { SqsClient } from '../lib/client'

const config = new Config()

const client = new SqsClient({
  sqsOptions: {
    region: 'cn-north-1',
    apiVersion: '2012-11-05',
  },
})

test.before(() => {
  sinon.stub(client, 'createQueue').resolves({ Locator: 'http://test:c' })
})

test.cb.serial('should receive message', t => {
  const c1 = new Queue(client, 'c1', {}, config)
  t.context.sandbox
    .stub(client, 'receiveMessageBatch')
    .onFirstCall()
    .resolves({ Messages: [{ Body: '{"text":"hahaha"}' }] })

  c1.onMessage((message, done) => {
    t.deepEqual(message, { text: 'hahaha' })
    t.truthy(done)
    t.end()
  })
})

test.cb.serial('should delete message on done', t => {
  const c2 = new Queue(client, 'c2', {}, config)
  t.context.sandbox
    .stub(client, 'receiveMessageBatch')
    .onFirstCall()
    .resolves({ Messages: [{ ReceiptHandle: '1', Body: '{"text":"hahaha"}' }] })

  const mock = t.context.sandbox
    .mock(client)
    .expects('deleteMessage')
    .once()
    .withArgs({
      Locator: 'http://test:c',
      ReceiptHandle: '1',
    })
    .resolves()

  c2.onMessage((message, done) => {
    t.deepEqual(message, { text: 'hahaha' })
    done()
    setTimeout(() => {
      mock.verify()
      t.end()
    }, 200)
  })
})

test.serial('should handle consumer handler timeout', t => {
  const c3 = new Queue(client, 'c3', {}, config)
  t.context.sandbox
    .stub(client, 'receiveMessageBatch')
    .resolves({ Messages: [{ ReceiptHandle: '1', Body: '{"text":"hahaha"}' }] })

  const consumer = c3.onMessage(
    () => {
      // do nothing, wait for timeout
    },
    { visibilityTimeout: 1 },
  )

  return new Bluebird(resolve => {
    consumer.on('error', err => {
      t.is(err.message, 'Consumer[c3] handler error: operation timed out')
      resolve()
    })
  }).timeout(2000)
})

test.cb.serial('should delete batch messages on done', t => {
  const c4 = new Queue(client, 'c4', {}, config)
  t.context.sandbox
    .stub(client, 'receiveMessageBatch')
    .onFirstCall()
    .resolves({
      Messages: [
        { ReceiptHandle: '1', Body: '{"text":"hahaha1"}' },
        { ReceiptHandle: '2', Body: '{"text":"hahaha2"}' },
        { ReceiptHandle: '3', Body: '{"text":"hahaha3"}' },
        { ReceiptHandle: '4', Body: '{"text":"hahaha4"}' },
      ],
    })

  const mock = t.context.sandbox
    .mock(client)
    .expects('deleteMessageBatch')
    .once()
    .withArgs({
      Locator: 'http://test:c',
      Entries: [
        { Id: '0', ReceiptHandle: '1' },
        { Id: '1', ReceiptHandle: '2' },
        { Id: '2', ReceiptHandle: '3' },
        { Id: '3', ReceiptHandle: '4' },
      ],
    })
    .resolves()

  c4.onMessage(
    (messages, done) => {
      t.deepEqual(messages, [
        { text: 'hahaha1' },
        { text: 'hahaha2' },
        { text: 'hahaha3' },
        { text: 'hahaha4' },
      ])
      setTimeout(() => {
        done()
        mock.verify()
        t.end()
      }, 200)
    },
    { batchHandle: true },
  )
})
