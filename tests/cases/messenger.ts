import test from '../_init'
import * as sinon from 'sinon'
import * as Promise from 'bluebird'

import { sqs, sns } from '../../lib/clients'
import SqsMessenger from '../../lib/messenger'
import Queue from '../../lib/queue'
import Consumer from '../../lib/consumer'
import Topic from '../../lib/topic'

test.beforeEach(t => {
  t.context.sandbox.stub(sqs, 'createQueue').callsArgWithAsync(1, null, {
    QueueUrl: 'http://test:c'
  })
  t.context.sandbox.stub(sqs, 'deleteMessage').callsFake((params, callback) => callback())
  t.context.sandbox.stub(sns, 'createTopic').callsArgWithAsync(1, null, { TopicArn: 'arn:aws-cn:sns:cn-north-1:abc:test_t1' })
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

test.cb.serial('register one consumer', t => {
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

test.serial.cb.skip('register two consumers', t => {
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

test.cb.serial('bind topic', t => {
  const topicSubscribeStub = t.context.sandbox.stub(Topic.prototype, 'subscribe').callsFake(() => { })
  const sqsMessenger = new SqsMessenger({ sqs }, {
    sqsArnPrefix: 'arn:sqs:test:',
    resourceNamePrefix: 'test_'
  })
  const topic = new Topic('topic')
  const quene = sqsMessenger.createQueue('myQueue', {
    bindTopic: topic,
  })
  quene.on('ready', () => {
    t.true(topicSubscribeStub.calledOnce)
    t.true(topicSubscribeStub.calledOn(topic))
    t.true(topicSubscribeStub.calledWith(quene))
    t.end()
  })
})

test.cb.serial('bind topics', t => {
  const topicSubscribeStub = t.context.sandbox.stub(Topic.prototype, 'subscribe').callsFake(() => { })
  const sqsMessenger = new SqsMessenger({ sqs }, {
    sqsArnPrefix: 'arn:sqs:test:',
    resourceNamePrefix: 'test_'
  })
  const topic1 = new Topic('topic1')
  const topic2 = new Topic('topic2')
  const topic3 = new Topic('topic3')
  const quene = sqsMessenger.createQueue('myQueue', {
    bindTopics: [topic1, topic2, topic3],
  })
  quene.on('ready', () => {
    t.true(topicSubscribeStub.calledThrice)
    t.true(topicSubscribeStub.calledOn(topic1))
    t.true(topicSubscribeStub.calledOn(topic2))
    t.true(topicSubscribeStub.calledOn(topic3))
    t.true(topicSubscribeStub.calledWith(quene))
    t.end()
  })
})

test.cb.serial('send empty queue', t => {
  const sqsMessenger = new SqsMessenger({ sqs }, {
    sqsArnPrefix: 'arn:sqs:test:',
    resourceNamePrefix: 'test_'
  })
  t.throws(() => sqsMessenger.sendQueueMessage('foo', {}), 'Queue[foo] not found')
  t.end()
})
