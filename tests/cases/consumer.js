const test = require('ava')
const sinon = require('sinon')
const Promise = require('bluebird')

const sqs = require('../../lib/clients').sqs
const Queue = require('../../lib/queue')
const config = require('../../lib/config')

test.before(t => {
  sinon.stub(sqs, 'createQueue')
      .callsArgWithAsync(1, null, { QueueUrl: 'http://test:c' })
})
test.beforeEach(t => {
  t.context.sandbox = sinon.sandbox.create()
})

test.afterEach(t => {
  t.context.sandbox.restore()
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
