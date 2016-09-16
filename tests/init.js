const AWS = require('aws-sdk')

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
