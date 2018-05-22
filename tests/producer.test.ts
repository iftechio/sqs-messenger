import test from './_init'
import { SQS, SNS } from 'aws-sdk'

import Producer from '../lib/producer'
import Topic from '../lib/topic'
import Queue from '../lib/queue'

const sqs = new SQS({
  region: 'cn-north-1',
  apiVersion: '2012-11-05',
})

const sns = new SNS({
  region: 'cn-north-1',
  apiVersion: '2010-03-31',
})

const producer = new Producer({ sqs, sns })

test('should send to topic', t => {
  const mock = t.context.sandbox
    .mock(sns)
    .expects('publish')
    .once()
    .callsArgWithAsync(1, null, {})

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
    .mock(sqs)
    .expects('sendMessage')
    .once()
    .callsArgWithAsync(1, null, {})

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
