import SqsMessenger from '../lib/messenger'

const sqsMessenger = new SqsMessenger({
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
