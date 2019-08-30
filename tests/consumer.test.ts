import test from './_init'
import * as sinon from 'sinon'
import * as Bluebird from 'bluebird'
import * as MNS from '@ruguoapp/mns-node-sdk'

import Queue from '../lib/queue'

const mns = new MNS.Client('<account-id>', '<region>', '<access-key-id>', '<access-key-secret>')

test.before(() => {
  sinon.stub(mns, 'createQueue').resolves({ Location: 'http://test:c' })
})

test.cb.serial('should receive message', t => {
  const c1 = new Queue(mns, 'c1')
  t.context.sandbox.stub(mns, 'batchReceiveMessage').onFirstCall().resolves([{ MessageBody: '{"text":"hahaha"}' }])

  c1.onMessage((message, done) => {
    t.deepEqual(message, { text: 'hahaha' })
    t.truthy(done)
    t.end()
  })
})

test.only.cb.serial('should delete message on done', t => {
  const c2 = new Queue(mns, 'c2')
  t.context.sandbox.stub(mns, 'batchReceiveMessage').resolves([{ ReceiptHandle: '1', MessageBody: '{"text":"hahaha"}' }])

  const mock = t.context.sandbox
    .mock(mns)
    .expects('deleteMessage')
    .withExactArgs('c2', 1)
    .resolves()

  c2.onMessage((message, done) => {
    t.deepEqual(message, { text: 'hahaha' })
    done()
    mock.verify()
  })

  setTimeout(() => {
    t.end()
  }, 200)
})

test.serial('should handle consumer handler timeout', t => {
  const c3 = new Queue(mns, 'c3')
  t.context.sandbox.stub(mns, 'batchReceiveMessage').resolves([{ MessageBody: '{"text":"hahaha"}' }])

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
  const c4 = new Queue(mns, 'c4')
  t.context.sandbox.stub(mns, 'batchReceiveMessage')
    .resolves([
      { ReceiptHandle: '1', MessageBody: '{"text":"hahaha1"}' },
      { ReceiptHandle: '2', MessageBody: '{"text":"hahaha2"}' },
      { ReceiptHandle: '3', MessageBody: '{"text":"hahaha3"}' },
      { ReceiptHandle: '4', MessageBody: '{"text":"hahaha4"}' },
    ])

  const mock = t.context.sandbox
    .mock(mns)
    .expects('batchDeleteMessage')
    .once()
    .withArgs('c4', ['1', '2', '3', '4'])
    .resolves()

  c4.onMessage(
    (messages, done) => {
      t.deepEqual(messages, [
        { text: 'hahaha1' },
        { text: 'hahaha2' },
        { text: 'hahaha3' },
        { text: 'hahaha4' },
      ])
      done()
    },
    { batchHandle: true },
  )
  setTimeout(() => {
    mock.verify()
    t.end()
  }, 200)
})
