const test = require('ava')
const AWS = require('aws-sdk')
const sinon = require('sinon')

const sqs = new AWS.SQS({
  region: 'cn-north-1',
  sqs: '2012-11-05',
})

const sns = new AWS.SNS({
  region: 'cn-north-1',
  sns: '2010-03-31',
})

require('../lib/clients').set({
  sqs, sns,
})

test.beforeEach(t => {
  t.context.sandbox = sinon.sandbox.create()
})

test.afterEach.always(t => {
  t.context.sandbox.restore()
})

module.exports = test
