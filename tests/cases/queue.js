const Promise = require('bluebird')
const sinon = require('sinon')
const test = require('ava')

const sqs = require('../../lib/clients').sqs
const Queue = require('../../lib/queue')
const config = require('../../lib/config')

test.before(t => {
  sinon.stub(config, 'getResourceNamePrefix').returns('test_')
  sinon.stub(config, 'getSqsArnPrefix').returns('arn:sqs:test:')
})
test.beforeEach(t => {
  t.context.sandbox = sinon.sandbox.create()
})

test.afterEach(t => {
  t.context.sandbox.restore()
})

test.serial('should create queue', t => {
  const mock = t.context.sandbox.mock(sqs).expects('createQueue')
      .once()
      .callsArgWithAsync(1, null, {
        QueueUrl: 'http://test_q1',
      })

  const q1 = new Queue('q1')
  return Promise.delay(200).then(() => {
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
        VisibilityTimeout: '30',
        MaximumMessageSize: '262144',
        Policy: expectPolicy,
      },
    })
  })
})

test.serial('should create deadletter queue', t => {
  const mock = t.context.sandbox.mock(sqs).expects('createQueue')
      .twice()
      .callsArgWithAsync(1, null, {
        QueueUrl: 'http://test_q1',
      })

  const q2 = new Queue('q2', { withDeadLetter: true })
  return Promise.delay(200).then(() => {
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
        VisibilityTimeout: '30',
        MaximumMessageSize: '262144',
        Policy: expectPolicy,
        RedrivePolicy: '{"maxReceiveCount":"5", "deadLetterTargetArn":"arn:sqs:test:test_q2-dl"}',
      },
    })
  })
})

