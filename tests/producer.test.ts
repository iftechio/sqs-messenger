import test from './_init'

import Producer from '../lib/producer'
import Topic from '../lib/topic'
import Queue from '../lib/queue'
import * as MNS from '@ruguoapp/mns-node-sdk'

const mns = new MNS.Client('<account-id>', '<region>', '<access-key-id>', '<access-key-secret>')

const producer = new Producer(mns)

test('should send to topic', t => {
  t.context.sandbox
    .stub(mns, 'createTopic')
    .resolves({ Location: 'http://test_t1' })
  const mock = t.context.sandbox
    .mock(mns)
    .expects('publishMessage')
    .once()
    .resolves({
      MessageId: 'id',
      MessageBodyMD5: 'md5'
    })

  const message = { text: 'abc' }
  const metaAttachedMessage = { MessageBody: '{"_meta":{"topicName":"t2"},"text":"abc"}' }
  const t2 = new Topic(mns, 't2')
  return producer.sendTopic(t2, message)
    .then(() => {
      mock.verify()
      t.deepEqual(mock.firstCall.args[0], t2.name)
      t.deepEqual(mock.firstCall.args[1], metaAttachedMessage)
    })
})

test('should send to queue', t => {
  t.context.sandbox
    .stub(mns, 'createQueue')
    .resolves({ Location: 'http://test_t1' })
  const mock = t.context.sandbox
    .mock(mns)
    .expects('sendMessage')
    .once()
    .resolves({
      MessageId: 'id',
      MessageBodyMD5: 'md5'
    })

  const message = { text: 'abc' }
  const metaAttachedMessage = { MessageBody: '{"_meta":{},"text":"abc"}' }
  const tq = new Queue(mns, 'tq')
  return producer
    .sendQueue(
      tq,
      message,
    )
    .then(() => {
      mock.verify()
      t.deepEqual(mock.firstCall.args[0], tq.name)
      t.deepEqual(mock.firstCall.args[1], metaAttachedMessage)
    })
})
