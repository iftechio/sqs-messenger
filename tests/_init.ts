import test from 'ava'
import 'source-map-support/register'
import * as AWS from 'aws-sdk'
import * as sinon from 'sinon'

import * as clients from '../lib/clients'

const sqs = new AWS.SQS({
  region: 'cn-north-1',
  apiVersion: '2012-11-05',
})

const sns = new AWS.SNS({
  region: 'cn-north-1',
  apiVersion: '2010-03-31',
})

clients.set({
  sqs, sns,
})

test.beforeEach(t => {
  t.context.sandbox = sinon.sandbox.create()
})

test.afterEach.always(t => {
  t.context.sandbox.restore()
})

export default test
