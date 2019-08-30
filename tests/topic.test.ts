import test from './_init'
import * as Bluebird from 'bluebird'
import * as MNS from '@ruguoapp/mns-node-sdk'

import Topic from '../lib/topic'
import Queue from '../lib/queue'

const mns = new MNS.Client('<account-id>', '<region>', '<access-key-id>', '<access-key-secret>')


test.cb.serial('should create topic', t => {
  const mock = t.context.sandbox
    .mock(mns)
    .expects('createTopic')
    .once()
    .resolves({
      Location: 'http://test_t1',
    })

  const t1 = new Topic(mns, 't1')
  t1.on('ready', () => {
    mock.verify()
    t.end()
  })
})

test.serial('should bind queue', t => {
  t.context.sandbox
    .stub(mns, 'createTopic')
    .resolves({ Location: 'http://test_t1' })
  t.context.sandbox
    .stub(mns, 'createQueue')
    .resolves({ Location: 'http://test/q1' })

  const subStub = t.context.sandbox
    .mock(mns)
    .expects('subscribe')
    .once()
    .resolves(1, null, { Location: 'http://test/s1' })

  const tq = new Queue(mns, 'tq')
  const t2 = new Topic(mns, 't2')
  t2.subscribe(tq, 'ts').catch(console.error)

  return Bluebird.delay(200).then(() => {
    t.truthy(subStub.calledOnce)
    t.deepEqual(subStub.firstCall.args[0], 't2')
    t.deepEqual(subStub.firstCall.args[1], 'ts')
  })
})
