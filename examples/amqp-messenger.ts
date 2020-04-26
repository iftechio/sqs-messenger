import { AmqpClient } from '../lib/client'
import AmqpMessenger from '../lib/messenger'

const client = new AmqpClient({
  hostname: '',
  vhost: '',
  username: '',
  password: '',
})

const sqsMessenger = new AmqpMessenger(client, {
  resourceNamePrefix: 'test_',
  errorHandler: err => {
    console.log('Error handled')
    console.error(err.stack)
  },
})

const myTopic = sqsMessenger.createTopic('myTopic')
const myQueue = sqsMessenger.createQueue('myQueue', {
  bindTopic: myTopic,
  withDeadLetter: true,
})

// tslint:disable-next-line:no-unused
myQueue.deadLetterQueue.onMessage((messsage, done) => {
  // do something
  done()
})
// register consumer on queue
sqsMessenger.onBatch(
  'myQueue',
  (message, done) => {
    // do something
    console.log(message)
    done()
  },
  {
    batchSize: 10,
  },
)

// send message to topic
sqsMessenger
  .sendTopicMessage('myTopic', { text: 'a simple message send to topic' })
  .catch(console.error)

// send message to queue
sqsMessenger
  .sendQueueMessage('myQueue', { text: 'a simple message send directly to queue' })
  .catch(console.error)
