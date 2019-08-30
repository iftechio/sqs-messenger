import * as MNS from '@ruguoapp/mns-node-sdk'

import Messenger from '../lib/messenger'
import Queue from '../lib/queue'
import Consumer from '../lib/consumer'
import Topic from '../lib/topic'
import test from './_init'

const mns = new MNS.Client('<account-id>', '<region>', '<access-key-id>', '<access-key-secret>')

test.beforeEach(t => {
  t.context.sandbox.stub(mns, 'createQueue').resolves({
    Location: 'http://test:c',
  })
  // tslint:disable-next-line:no-unused
  t.context.sandbox.stub(mns, 'deleteMessage').resolves()
  t.context.sandbox
    .stub(mns, 'createTopic')
    .resolves({ Location: 'arn:aws-cn:sns:cn-north-1:abc:test_t1' })
})

test.serial('create queue', t => {
  const messenger = new Messenger(mns)
  const queue = messenger.createQueue('myQueue')
  t.true(queue instanceof Queue)
  t.pass()
})

test.cb.serial('register one consumer', t => {
  t.context.sandbox.stub(mns, 'batchReceiveMessage').onFirstCall().resolves([{ MessageBody: '{}' }])
  const messenger = new Messenger(mns)
  messenger.createQueue('myQueue')

  // tslint:disable-next-line:no-unused
  const consumer = messenger.on('myQueue', (message, done) => {
    done()
    t.end()
  })

  t.true(consumer instanceof Consumer)
})

test.cb.serial('register two consumers', t => {
  const receiveMessage = t.context.sandbox.stub(mns, 'batchReceiveMessage')
  receiveMessage.onFirstCall().resolves([{ MessageBody: '{"n": 1}' }])
  receiveMessage.onSecondCall().resolves([{ MessageBody: '{"n": 2}' }])
  receiveMessage.resolves([{ MessageBody: '' }])

  const messenger = new Messenger(mns)
  messenger.createQueue('myQueue')

  const numbers: any[] = []
  const consumers = messenger.on(
    'myQueue',
    (message, done) => {
      numbers.push(message.n)
      setTimeout(() => {
        done()
        if (message.n === 2) {
          t.deepEqual(numbers, [1, 2])
          t.end()
        }
      }, 200)
    },
    { consumers: 2 },
  ) as Consumer[]

  t.true(consumers.length === 2)
  consumers.forEach(consumer => {
    t.true(consumer instanceof Consumer)
  })
})

test.cb.serial('bind topic', t => {
  const topicSubscribeStub = t.context.sandbox.stub(Topic.prototype, 'subscribe').callsFake()
  const messenger = new Messenger(mns)
  const topic = new Topic(mns, 'topic')
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
  const topicSubscribeStub = t.context.sandbox.stub(Topic.prototype, 'subscribe').callsFake()
  const messenger = new Messenger(mns)
  const topic1 = new Topic(mns, 'topic1')
  const topic2 = new Topic(mns, 'topic2')
  const topic3 = new Topic(mns, 'topic3')
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
  const messenger = new Messenger(mns)
  messenger.sendQueueMessage('foo', {}).catch(err => {
    t.is(err.message, 'Queue[foo] not found')
    t.end()
  })
})
