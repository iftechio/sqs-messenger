import test from './_init'
import * as Bluebird from 'bluebird'
import * as sinon from 'sinon'
import * as MNS from '@ruguoapp/mns-node-sdk'

import Queue from '../lib/queue'

const mns = new MNS.Client('<account-id>', '<region>', '<access-key-id>', '<access-key-secret>')

test.serial('should create queue', t => {
  const mock = t.context.sandbox
    .mock(mns)
    .expects('createQueue')
    .once()
    .resolves({
      Location: 'http://test_q1',
    })

  // tslint:disable-next-line:no-unused-expression
  new Queue(mns, 'test_q1')
  return Bluebird.delay(200).then(() => {
    mock.verify()
    t.deepEqual(mock.firstCall.args[0], 'test_q1')
    t.deepEqual(mock.firstCall.args[1], {
      VisibilityTimeout: 30,
      MaximumMessageSize: 65536,
      MessageRetentionPeriod: 259200,
      DelaySeconds: 0,
      PollingWaitSeconds: 0,
      LoggingEnabled: false,
    })
  })
})

function shutdownMacro(t, input, expected) {
  const sandbox = t.context.sandbox

  sandbox.stub(mns, 'createQueue').resolves({
    Location: 'http://test:c',
  })

  sandbox.stub(mns, 'batchReceiveMessage').resolves([{ MessageBody: '{}' }])

  sandbox.stub(mns, 'deleteMessage').resolves()
  sandbox.stub(mns, 'batchDeleteMessage').resolves()

  const queue = new Queue(mns, 'q')
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
