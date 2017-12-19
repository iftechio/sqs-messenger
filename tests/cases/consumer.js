const test = require('../_init')
const sinon = require('sinon')
const Promise = require('bluebird')

const sqs = require('../../lib/clients').sqs
const Queue = require('../../lib/queue')
const config = require('../../lib/config')

test.before(t => {
  sinon.stub(sqs, 'createQueue')
    .callsArgWithAsync(1, null, { QueueUrl: 'http://test:c' })
})

test.serial.cb('should receive message', t => {
  const c1 = new Queue('c1')
  t.context.sandbox.stub(sqs, 'receiveMessage')
    .onFirstCall()
    .callsArgWithAsync(1, null, { Messages: [{ Body: '{"text":"hahaha"}' }] })

  c1.onMessage((message, done) => {
    t.deepEqual(message, { text: 'hahaha' })
    t.truthy(done)
    t.end()
  })
})

test.serial.cb('should delete message on done', t => {
  const c2 = new Queue('c2')
  t.context.sandbox.stub(sqs, 'receiveMessage')
    .onFirstCall()
    .callsArgWithAsync(1, null, { Messages: [{ ReceiptHandle: '1', Body: '{"text":"hahaha"}' }] })

  const mock = t.context.sandbox.mock(sqs).expects('deleteMessage')
    .once()
    .withArgs({
      QueueUrl: 'http://test:c',
      ReceiptHandle: '1',
    })
    .callsArgWithAsync(1, null, null)

  c2.onMessage((message, done) => {
    t.deepEqual(message, { text: 'hahaha' })
    done()
  })
  setTimeout(() => {
    mock.verify()
    t.end()
  }, 200)
})

test.serial('should handle consumer handler timeout', t => {
  const c3 = new Queue('c3')
  t.context.sandbox.stub(sqs, 'receiveMessage')
    .onFirstCall()
    .callsArgWithAsync(1, null, { Messages: [{ Body: '{"text":"hahaha"}' }] })

  const consumer = c3.onMessage((message, done) => {
    // do nothing, wait for timeout
  }, { visibilityTimeout: 1 })

  return new Promise((resolve, reject) => {
    consumer.on('error', (msg, err) => {
      try {
        t.is(msg, 'Consumer[c3] handler error')
      } catch (e) {
        reject(e)
      }
      resolve()
    })
  }).timeout(2000)
})

test.serial.cb('should delete batch messages on done', t => {
  const c4 = new Queue('c4')
  t.context.sandbox.stub(sqs, 'receiveMessage')
    .onFirstCall()
    .callsArgWithAsync(1, null, {
      Messages: [
        { ReceiptHandle: '1', Body: '{"text":"hahaha1"}' },
        { ReceiptHandle: '2', Body: '{"text":"hahaha2"}' },
        { ReceiptHandle: '3', Body: '{"text":"hahaha3"}' },
        { ReceiptHandle: '4', Body: '{"text":"hahaha4"}' },
      ]
    })

  const mock = t.context.sandbox.mock(sqs).expects('deleteMessageBatch')
    .once()
    .withArgs({
      QueueUrl: 'http://test:c',
      Entries: [
        { Id: '0', ReceiptHandle: '1' },
        { Id: '1', ReceiptHandle: '2' },
        { Id: '2', ReceiptHandle: '3' },
        { Id: '3', ReceiptHandle: '4' },
      ]
    })
    .callsArgWithAsync(1, null, null)

  c4.onMessage((messages, done) => {
    t.deepEqual(messages, [
      { text: 'hahaha1' },
      { text: 'hahaha2' },
      { text: 'hahaha3' },
      { text: 'hahaha4' },
    ])
    done()
  }, { batchHandle: true })
  setTimeout(() => {
    mock.verify()
    t.end()
  }, 200)
})
