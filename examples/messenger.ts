import { SQS, SNS } from 'aws-sdk'
import SqsMessenger from '../lib/messenger'

const sqs = new SQS({
  region: 'cn-north-1',
  apiVersion: '2012-11-05',
})

const sns = new SNS({
  region: 'cn-north-1',
  apiVersion: '2010-03-31',
})

const sqsMessenger = new SqsMessenger({ sqs, sns }, {
  snsArnPrefix: 'arn:aws-cn:sns:cn-north-1:123456789012:',
  sqsArnPrefix: 'arn:aws-cn:sqs:cn-north-1:123456789012:',
  queueUrlPrefix: 'http://sqs.cn-north-1.amazonaws.com.cn/123456789012/',
  resourceNamePrefix: 'test_',
})

sqsMessenger.onError(err => {
  console.log('Error handled')
  console.error(err.stack)
})

const myTopic = sqsMessenger.createTopic('myTopic')
const myQueue = sqsMessenger.createQueue('myQueue', {
  bindTopic: myTopic,
  withDeadLetter: true,
})

myQueue.deadLetterQueue.onMessage((messsage, done) => {
  // do something
  done()
})
// register consumer on queue
sqsMessenger.on('myQueue', (message, done) => {
  // do something
  console.log(message)
  done()
}, {
    batchSize: 10,
  })

// send message to topic
sqsMessenger.sendTopicMessage('myTopic', { text: 'a simple message send to topic' })

// send message to queue
sqsMessenger.sendQueueMessage('myQueue', { text: 'a simple message send directly to queue' })
