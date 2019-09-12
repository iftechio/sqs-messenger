import { MnsClient } from '../lib/client'
import MnsMessenger from '../lib/messenger'


const client = new MnsClient({
  accountId: "",
  region: "",
  accessKeyId: "",
  accessKeySecret: "",
})

const mnsMessenger = new MnsMessenger(client, {
  resourceNamePrefix: 'test_',
  errorHandler: err => {
    console.log('Error handled')
    console.error(err.stack)
  },
})

const myTopic = mnsMessenger.createTopic('myTopic')
const myQueue = mnsMessenger.createQueue('myQueue', {
  bindTopic: myTopic,
  withDeadLetter: true,
})

// tslint:disable-next-line:no-unused
myQueue.deadLetterQueue.onMessage((messsage, done) => {
  // do something
  done()
})
// register consumer on queue
mnsMessenger.onBatch(
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
mnsMessenger
  .sendTopicMessage('myTopic', { text: 'a simple message send to topic' })
  .catch(console.error)

// send message to queue
mnsMessenger
  .sendQueueMessage('myQueue', { text: 'a simple message send directly to queue' })
  .catch(console.error)
