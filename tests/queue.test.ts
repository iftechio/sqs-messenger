import test from './_init'
import * as Bluebird from 'bluebird'
import * as sinon from 'sinon'

import Queue from '../lib/queue'
import Config from '../lib/config'
import { SqsClient } from '../lib/client'

const client = new SqsClient({
  sqsOptions: {
    region: 'cn-north-1',
    apiVersion: '2012-11-05',
  },
})

const config = new Config({
  resourceNamePrefix: 'test_',
  sqsArnPrefix: 'arn:sqs:test:',
})

test.serial('should create queue', t => {
  const mock = t.context.sandbox
    .mock(client)
    .expects('createQueue')
    .once()
    .resolves({
      Locator: 'http://test_q1',
    })

  // tslint:disable-next-line:no-unused-expression
  new Queue(client, 'q1', {}, config)
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
        MaximumMessageSize: '65536',
        Policy: expectPolicy,
        MessageRetentionPeriod: '345600',
        PollingWaitSeconds: '0',
        LoggingEnabled: false,
      },
    })
  })
})

test.serial('should create deadletter queue', t => {
  const mock = t.context.sandbox
    .mock(client)
    .expects('createQueue')
    .twice()
    .resolves({
      Locator: 'http://test_q1',
    })

  // tslint:disable-next-line:no-unused-expression
  new Queue(client, 'q2', { withDeadLetter: true }, config)
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
        MaximumMessageSize: '65536',
        Policy: expectPolicy,
        RedrivePolicy: '{"maxReceiveCount":"5", "deadLetterTargetArn":"arn:sqs:test:test_q2-dl"}',
        MessageRetentionPeriod: '345600',
        PollingWaitSeconds: '0',
        LoggingEnabled: false,
      },
    })
  })
})

function shutdownMacro(t, input, expected) {
  const sandbox = t.context.sandbox
  sandbox.stub(client, 'createQueue').resolves({
    Locator: 'http://test:c',
  })
  sandbox
    .stub(client, 'receiveMessage')
    .onFirstCall()
    .resolves({
      Messages: [{ Body: '{}' }],
    })
  sandbox
    .stub(client, 'deleteMessage')
    // tslint:disable-next-line:no-unused
    .callsFake((params, callback) => callback())
    .resolves()

  const queue = new Queue(client, 'q', {}, config)
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
