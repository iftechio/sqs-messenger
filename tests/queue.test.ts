import test from './_init'
import * as Bluebird from 'bluebird'
import * as sinon from 'sinon'
import { SQS } from 'aws-sdk'

import Queue from '../lib/queue'
import Config from '../lib/config'

const sqs = new SQS({
  region: 'cn-north-1',
  apiVersion: '2012-11-05',
})

const config = new Config({
  resourceNamePrefix: 'test_',
  sqsArnPrefix: 'arn:sqs:test:',
})

test.serial('should create queue', t => {
  const mock = t.context.sandbox
    .mock(sqs)
    .expects('createQueue')
    .once()
    .callsArgWithAsync(1, null, {
      QueueUrl: 'http://test_q1',
    })

  // tslint:disable-next-line:no-unused-expression
  new Queue(sqs, 'q1', {}, config)
  return Bluebird.delay(200).then(() => {
    mock.verify()
    const expectPolicy = JSON.stringify({
      Version: '2012-10-17',
      Id: 'arn:sqs:test:test_q1/SQSDefaultPolicy',
      Statement: [
        {
          Sid: '1',
          Effect: 'Allow',
          Principal: '*',
          Action: 'SQS:SendMessage',
          Resource: 'arn:sqs:test:test_q1',
        },
      ],
    })
    t.deepEqual(mock.firstCall.args[0], {
      QueueName: 'test_q1',
      Attributes: {
        DelaySeconds: '0',
        VisibilityTimeout: '30',
        MaximumMessageSize: '262144',
        Policy: expectPolicy,
      },
    })
  })
})

test.serial('should create deadletter queue', t => {
  const mock = t.context.sandbox
    .mock(sqs)
    .expects('createQueue')
    .twice()
    .callsArgWithAsync(1, null, {
      QueueUrl: 'http://test_q1',
    })

  // tslint:disable-next-line:no-unused-expression
  new Queue(sqs, 'q2', { withDeadLetter: true }, config)
  return Bluebird.delay(200).then(() => {
    mock.verify()
    t.deepEqual(mock.firstCall.args[0], {
      QueueName: 'test_q2-dl',
    })

    const expectPolicy = JSON.stringify({
      Version: '2012-10-17',
      Id: 'arn:sqs:test:test_q2/SQSDefaultPolicy',
      Statement: [
        {
          Sid: '1',
          Effect: 'Allow',
          Principal: '*',
          Action: 'SQS:SendMessage',
          Resource: 'arn:sqs:test:test_q2',
        },
      ],
    })

    t.deepEqual(mock.secondCall.args[0], {
      QueueName: 'test_q2',
      Attributes: {
        DelaySeconds: '0',
        VisibilityTimeout: '30',
        MaximumMessageSize: '262144',
        Policy: expectPolicy,
        RedrivePolicy: '{"maxReceiveCount":"5", "deadLetterTargetArn":"arn:sqs:test:test_q2-dl"}',
      },
    })
  })
})

function shutdownMacro(t, input, expected) {
  const sandbox = t.context.sandbox
  sandbox.stub(sqs, 'createQueue').callsArgWithAsync(1, null, {
    QueueUrl: 'http://test:c',
  })
  sandbox
    .stub(sqs, 'receiveMessage')
    .onFirstCall()
    .callsArgWithAsync(1, null, {
      Messages: [{ Body: '{}' }],
    })
  // tslint:disable-next-line:no-unused
  sandbox.stub(sqs, 'deleteMessage').callsFake((params, callback) => callback())

  const queue = new Queue(sqs, 'q', {}, config)
  return Bluebird.delay(200).then(() => {
    const spy = sinon.spy()
    // tslint:disable-next-line:no-unused
    const consumer = queue.onMessage((message, done) => {
      setTimeout(() => {
        spy()
        done()
      }, 500)
    })
    const startTime = Date.now()
    return queue.shutdown(input).then(() => {
      t.true(Date.now() - startTime < 1000)
      t.false(consumer.running)
      t.is(spy.called, expected)
    })
  })
}

test.serial('should shutdown gracefully with timeout', shutdownMacro, 10000, true)
test.serial('should shutdown violently without timeout', shutdownMacro, 0, false)
