import test from './_init'
import * as Bluebird from 'bluebird'

import Topic from '../lib/topic'
import Queue from '../lib/queue'
import Config from '../lib/config'
import { SqsClient } from '../lib/client'

const config = new Config({
  resourceNamePrefix: 'test_',
  sqsArnPrefix: 'arn:sqs:test:',
})

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

test.cb.serial('should create topic', t => {
  const mock = t.context.sandbox
    .mock(client)
    .expects('createTopic')
    .once()
    .withArgs({ TopicName: 'test_t1' })
    .resolves({ Locator: 'arn:aws-cn:sns:cn-north-1:abc:test_t1' })

  const t1 = new Topic(client, 't1', config)
  t1.on('ready', () => {
    mock.verify()
    t.end()
  })
})

test.serial('should bind queue', t => {
  t.context.sandbox
    .stub(client, 'createTopic')
    .resolves({ Locator: 'arn:aws-cn:sns:cn-north-1:abc:test_t1' })
  t.context.sandbox.stub(client, 'createQueue').resolves({ Locator: 'http://test/tq1' })

  const subStub = t.context.sandbox
    .mock(client)
    .expects('subscribe')
    .once()
    .resolves({ SubscribeLocator: 'arn:subscription' })
  const setAttrStub = t.context.sandbox.stub(client, 'setSubscriptionAttributes').resolves({})

  const tq = new Queue(client, 'tq', {}, config)
  const t2 = new Topic(client, 't2', config)
  t2.subscribe(tq).catch(console.error)

  return Bluebird.delay(200).then(() => {
    t.truthy(subStub.calledOnce)
    t.truthy(setAttrStub.calledOnce)
    t.deepEqual(subStub.firstCall.args[0], {
      Protocol: 'sqs',
      TopicLocator: 'arn:aws-cn:sns:cn-north-1:abc:test_t1',
      Endpoint: 'arn:sqs:test:test_tq',
    })
    t.deepEqual(setAttrStub.firstCall.args[0], {
      SubscribeLocator: 'arn:subscription',
      AttributeName: 'RawMessageDelivery',
      AttributeValue: 'true',
    })
  })
})
