import test from './_init'
import * as sinon from 'sinon'
import * as Promise from 'bluebird'
import { SQS, SNS } from 'aws-sdk'

import Messenger from '../lib/messenger'
import Queue from '../lib/queue'
import Consumer from '../lib/consumer'
import Topic from '../lib/topic'
import Config from '../lib/config'

const config = new Config()

const sqs = new SQS({
  region: 'cn-north-1',
  apiVersion: '2012-11-05',
})

const sns = new SNS({
  region: 'cn-north-1',
  apiVersion: '2010-03-31',
})

test.beforeEach(t => {
  t.context.sandbox.stub(sqs, 'createQueue').callsArgWithAsync(1, null, {
    QueueUrl: 'http://test:c'
  })
  t.context.sandbox.stub(sqs, 'deleteMessage').callsFake((params, callback) => callback())
  t.context.sandbox.stub(sns, 'createTopic').callsArgWithAsync(1, null, { TopicArn: 'arn:aws-cn:sns:cn-north-1:abc:test_t1' })
})

test.serial('create queue', t => {
  const messenger = new Messenger({ sqs, sns }, {
    sqsArnPrefix: 'arn:sqs:test:',
    resourceNamePrefix: 'test_'
  })
  const queue = messenger.createQueue('myQueue')
  t.true(queue instanceof Queue)
  t.pass()
})

test.cb.serial('register one consumer', t => {
  t.context.sandbox.stub(sqs, 'receiveMessage').onFirstCall().callsArgWithAsync(1, null, {
    Messages: [{ Body: '{}' }]
  })

  const messenger = new Messenger({ sqs, sns }, {
    sqsArnPrefix: 'arn:sqs:test:',
    resourceNamePrefix: 'test_'
  })

  messenger.createQueue('myQueue')

  const consumer = messenger.on('myQueue', (message, done) => {
    done()
    t.end()
  })

  t.true(consumer instanceof Consumer)
})

test.cb.serial.skip('register two consumers', t => {
  const receiveMessage = t.context.sandbox.stub(sqs, 'receiveMessage')
  receiveMessage.onFirstCall().callsArgWithAsync(1, null, {
    Messages: [{ Body: '{"n": 1}' }]
  })
  receiveMessage.onSecondCall().callsArgWithAsync(1, null, {
    Messages: [{ Body: '{"n": 2}' }]
  })

  const messenger = new Messenger({ sqs, sns }, {
    sqsArnPrefix: 'arn:sqs:test:',
    resourceNamePrefix: 'test_'
  })

  messenger.createQueue('myQueue')

  let numbers: any[] = []
  const consumers = messenger.on('myQueue', (message, done) => {
    numbers.push(message.n)
    setTimeout(() => {
      done()
      t.deepEqual(numbers, [1, 2])
      if (message.n == 2) {
        t.end()
      }
    }, 200)
  }, { batchSize: 1, consumers: 2 }) as Consumer[]

  t.true(consumers.length == 2)
  consumers.forEach(consumer => {
    t.true(consumer instanceof Consumer)
  })
})

test.cb.serial('bind topic', t => {
  const topicSubscribeStub = t.context.sandbox.stub(Topic.prototype, 'subscribe').callsFake(() => { })
  const messenger = new Messenger({ sqs, sns }, {
    sqsArnPrefix: 'arn:sqs:test:',
    resourceNamePrefix: 'test_'
  })
  const topic = new Topic(sns, 'topic', config)
  const quene = messenger.createQueue('myQueue', {
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
  const messenger = new Messenger({ sqs, sns }, {
    sqsArnPrefix: 'arn:sqs:test:',
    resourceNamePrefix: 'test_'
  })
  const topic1 = new Topic(sns, 'topic1', config)
  const topic2 = new Topic(sns, 'topic2', config)
  const topic3 = new Topic(sns, 'topic3', config)
  const quene = messenger.createQueue('myQueue', {
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
  const messenger = new Messenger({ sqs, sns }, {
    sqsArnPrefix: 'arn:sqs:test:',
    resourceNamePrefix: 'test_'
  })
  messenger.sendQueueMessage('foo', {}).catch(err => {
    t.is(err.message, 'Queue[foo] not found')
    t.end()
  })
})
