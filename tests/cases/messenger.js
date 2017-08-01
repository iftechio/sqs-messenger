const sinon = require('sinon')
const test = require('ava')
const Promise = require('bluebird')

const sqs = require('../../lib/clients').sqs
const SqsMessenger = require('../../lib/messenger')
const Queue = require('../../lib/queue')
const Consumer = require('../../lib/consumer')

test.beforeEach(t => {
  t.context.sandbox = sinon.sandbox.create()
  t.context.sandbox.stub(sqs, 'createQueue').callsArgWithAsync(1, null, {
    QueueUrl: 'http://test:c'
  })
  t.context.sandbox.stub(sqs, 'deleteMessage', (params, callback) => callback())
})

test.afterEach(t => {
  t.context.sandbox.restore()
})

test.serial('create queue', t => {
  const sqsMessenger = new SqsMessenger({ sqs }, {
    sqsArnPrefix: 'arn:sqs:test:',
    resourceNamePrefix: 'test_'
  })
  const queue = sqsMessenger.createQueue('myQueue')
  t.true(queue instanceof Queue)
  t.pass()
})

test.serial.cb('register one consumer', t => {

  t.context.sandbox.stub(sqs, 'receiveMessage').onFirstCall().callsArgWithAsync(1, null, {
    Messages: [{ Body: '{}' }]
  })

  const sqsMessenger = new SqsMessenger({ sqs }, {
    sqsArnPrefix: 'arn:sqs:test:',
    resourceNamePrefix: 'test_'
  })

  sqsMessenger.createQueue('myQueue')
  
  const consumer = sqsMessenger.on('myQueue', (message, done) => {
    done()
    t.end()
  })

  t.true(consumer instanceof Consumer)

})

test.serial.cb('register two consumers', t => {

  const receiveMessage = t.context.sandbox.stub(sqs, 'receiveMessage')
  receiveMessage.onFirstCall().callsArgWithAsync(1, null, {
    Messages: [{ Body: '{"n": 1}' }]
  })
  receiveMessage.onSecondCall().callsArgWithAsync(1, null, {
    Messages: [{ Body: '{"n": 2}' }]
  })

  const sqsMessenger = new SqsMessenger({ sqs }, {
    sqsArnPrefix: 'arn:sqs:test:',
    resourceNamePrefix: 'test_'
  })

  sqsMessenger.createQueue('myQueue')
  
  let numbers = []
  const consumers = sqsMessenger.on('myQueue', (message, done) => {
    numbers.push(message.n)
    setTimeout(() => {
      done()
      t.deepEqual(numbers, [1, 2])
      if (message.n == 2) {
        t.end()
      }
    }, 200)
  }, { batchSize: 1, consumers: 2 })

  t.true(consumers.length == 2)
  consumers.forEach(consumer => {
    t.true(consumer instanceof Consumer)
  })

})
