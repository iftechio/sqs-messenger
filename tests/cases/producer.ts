import test from '../_init'
import * as sinon from 'sinon'

import * as clients from '../../lib/clients'
import Producer from '../../lib/producer'
import * as protocol from '../../lib/protocols/jsonProtocol'

let producer

test.before(t => {
  producer = new Producer(protocol)
})

test('should send to topic', t => {
  const mock = t.context.sandbox.mock(clients.sns).expects('publish')
    .once()
    .callsArgWithAsync(1, null, {})

  return producer.sendTopic({
    isReady: true,
    arn: 'arn:sns:test',
  }, { text: 'abc' }).then(() => {
    mock.verify()
    t.deepEqual(mock.firstCall.args[0], {
      TopicArn: 'arn:sns:test',
      Message: '{"text":"abc"}',
    })
  })
})

test('should send to queue', t => {
  const mock = t.context.sandbox.mock(clients.sqs).expects('sendMessage')
    .once()
    .callsArgWithAsync(1, null, {})

  return producer.sendQueue({
    isReady: true,
    arn: 'arn:sqs:test',
    queueUrl: 'http://sqs.test.com/q1',
  }, { text: 'abc' }).then(() => {
    mock.verify()
    t.deepEqual(mock.firstCall.args[0], {
      QueueUrl: 'http://sqs.test.com/q1',
      MessageBody: '{"text":"abc"}',
    })
  })
})
