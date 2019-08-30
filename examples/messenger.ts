import * as MNS from '@ruguoapp/mns-node-sdk'
import MnsMessenger from '../lib/messenger'

const mns = new MNS.Client('<account-id>', '<region>', '<access-key-id>', '<access-key-secret>')

const mnsMessenger = new MnsMessenger(mns, err => {
  console.log('Error handled')
  console.error(err.stack)
})

const myTopic = mnsMessenger.createTopic('myTopic')
const myQueue = mnsMessenger.createQueue('myQueue', {
  bindTopic: myTopic,
})

// tslint:disable-next-line:no-unused
myQueue.onMessage((messsage, done) => {
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
