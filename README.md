sqs-messenger
===

This library makes message sending/receiving in SQS/SNS easy.

Also support Aliyun MNS.

## Simple usage
```javascript
const SqsMessenger, { SqsClient } = require('sqs-messenger')

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

const sqsMessenger = new SqsMessenger(client, {
  snsArnPrefix: 'arn:aws-cn:sns:cn-north-1:123456789012:',
  sqsArnPrefix: 'arn:aws-cn:sqs:cn-north-1:123456789012:',
  queueUrlPrefix: 'http://sqs.cn-north-1.amazonaws.com.cn/123456789012/',
  resourceNamePrefix: 'test_',
})

const myTopic = sqsMessenger.createTopic('myTopic')
const myQueue = sqsMessenger.createQueue('myQueue', {
  bindTopic: myTopic,
})


// register consumer on queue
sqsMessenger.on('myQueue', (message, done) => {
  // do something
  console.log(message)
  done()
})

// send message to topic
sqsMessenger.sendTopicMessage('myTopic', { text: 'a simple message send to topic' })

// send message to queue
sqsMessenger.sendQueueMessage('myQueue', { text: 'a simple message send directly to queue' })
```

or

```javascript
const MnsMessenger, { MnsClient } = require('sqs-messenger')

const client = new MnsClient({
  accountId: '123456789012',
  region: 'cn-hangzhou',
  accessKeyId: 'ACCESS_KEY_ID',
  accessKeySecret: 'ACCESS_KEY_SECRET',
})

const mnsMessenger = new MnsMessenger(client, {
  sqsArnPrefix: 'acs:mns:cn-hangzhou:123456789012:queues/',
  queueUrlPrefix: 'http://123456789012.mns.cn-hangzhou.aliyuncs.com/queues/',
  resourceNamePrefix: 'test-',
  errorHandler: err => {
    console.log('Error handled')
    console.error(err.stack)
  },
})

const myTopic = mnsMessenger.createTopic('myTopic')
const myQueue = mnsMessenger.createQueue('myQueue', {
  bindTopic: myTopic,
})


// register consumer on queue
mnsMessenger.on('myQueue', (message, done) => {
  // do something
  console.log(message)
  done()
})

// send message to topic
mnsMessenger.sendTopicMessage('myTopic', { text: 'a simple message send to topic' })

// send message to queue
mnsMessenger.sendQueueMessage('myQueue', { text: 'a simple message send directly to queue' })
```

## Advanced usage
```javascript
const myQueue = sqsMessenger.createQueue('myQueue', {
  bindTopics: [myTopic],
  withDeadLetter: true,
  maxReceiveCount: 3,
  delaySeconds: 30,
})

// batchSize
sqsMessenger.on('myQueue', (message, done) => {
  // do something
  console.log(message)
  done()
}, {
  batchSize: 10
})

// batch handling
sqsMessenger.on('myQueue', (messages, done) => {
  console.log(messages.length) // 10
  done()
}, {
  batchSize: 10,
  batchHandle: true,
})

myQueue.deadLetterQueue.onMessage((messsage, done)=> {
  // do something
  done()
})

// Error handling
sqsMessenger.onError(err => {
  console.log('Error handled')
  console.error(err.stack)
})

// Start multiple consumers for a queue
sqsMessenger.on('myQueue', (message, done) => {
  // do something
  done()
}, {
  consumers: 5
})
```

## Graceful shutdown

shutdown queue with `queue.shutdown(timeout)`:

```javascript
const myQueue = sqsMessenger.createQueue('myQueue')
process.once('SIGTERM', () => {
  myQueue.shutdown(5000).then(() => {
    process.exit(0)
  })
})
```

or shutdown all queues with `messenger.shutdown(timeout)`,
each queue will have at most `timeout` time to cleanup:

```javascript
process.once('SIGTERM', () => {
  sqsMessenger.shutdown(5000).then(() => {
    process.exit(0)
  })
})
```

## Features
 - Automatically create topic, queue and subscription
 - Dead letter support
 - Automatically acknowledge message on consumer finished
 - Graceful shutdown support
 - Batch sending(TODO)
 - Message schema validation(TODO)
