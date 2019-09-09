export interface QueueClient {
  createQueue(params, callback?: (err, data) => void)
  sendMessage(params, callback?: (err, data) => void)
  receiveMessage(params, callback?: (err, data) => void)
  deleteMessage(params, callback?: (err, data) => void)
  deleteMessageBatch(params, callback?: (err, data) => void)
}

export interface TopicClient {
  createTopic(params, callback?: (err, data) => void)
  subscribe(params, callback?: (err, data) => void)
  setSubscriptionAttributes(params, callback?: (err, data) => void)
  publish(params, callback?: (err, data) => void)
}

export interface Message {
  ReceiptHandle?: string
  MessageId?: string
  Body?: string
}

export interface CreateQueueRequest {
  QueueName: string
  Attributes?: { [key: string]: string }
}

export interface CreateQueueResult {
  QueueUrl?: string
}

export interface SubscribeResponse {
  SubscriptionArn: string
}

// tslint:disable-next-line:no-empty-interface
export interface PublishResponse {}

// tslint:disable-next-line:no-empty-interface
export interface SendMessageResult {}

export interface ReceiveMessageResult {
  Messages: Message[]
}
