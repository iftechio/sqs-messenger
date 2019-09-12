import test from './_init'

import Producer from '../lib/producer'
import Topic from '../lib/topic'
import Queue from '../lib/queue'
import { SqsClient } from '../lib/client'

const client = new SqsClient({
  sqsOptions: {
    region: 'cn-north-1',
    apiVersion: '2012-11-05',
  },
  snsOptions: {
    region: 'cn-north-1',
    apiVersion: '2010-03-31',
  },
})

const producer = new Producer(client)

test('should send to topic', t => {
  const mock = t.context.sandbox
    .mock(client)
    .expects('publish')
    .once()
    .resolves({})

  const message = { text: 'abc' }
  const metaAttachedMessage = { _meta: { topicName: 'testTopic' }, ...message }
  return producer
    .sendTopic(
      {
        isReady: true,
        arn: 'arn:sns:test',
        name: 'testTopic',
      } as Topic,
      message,
    )
    .then(() => {
      mock.verify()
      t.deepEqual(mock.firstCall.args[0], {
        TopicArn: 'arn:sns:test',
        Message: JSON.stringify(metaAttachedMessage),
      })
    })
})

test('should send to queue', t => {
  const mock = t.context.sandbox
    .mock(client)
    .expects('sendMessage')
    .once()
    .resolves({})

  const message = { text: 'abc' }
  const metaAttachedMessage = { _meta: {}, ...message }
  return producer
    .sendQueue(
      {
        isReady: true,
        arn: 'arn:sqs:test',
        queueUrl: 'http://sqs.test.com/q1',
        name: 'testQueue',
      } as Queue,
      message,
    )
    .then(() => {
      mock.verify()
      t.deepEqual(mock.firstCall.args[0], {
        QueueUrl: 'http://sqs.test.com/q1',
        MessageBody: JSON.stringify(metaAttachedMessage),
      })
    })
})
