import { SQS, SNS } from 'aws-sdk'
import MNS, { Types } from '@ruguoapp/mns-node-sdk'
export interface Client {
  createQueue(params): Promise<any>
  sendMessage(params): Promise<any>
  receiveMessage(params): Promise<any>
  deleteMessage(params): Promise<any>
  deleteMessageBatch(params): Promise<any>

  createTopic(params): Promise<any>
  subscribe(params): Promise<any>
  setSubscriptionAttributes(params): Promise<any>
  publish(params): Promise<any>
}

export class SqsClient implements Client {
  sqs: SQS
  sns: SNS

  constructor({
    sqsOptions,
    snsOptions,
  }: {
    sqsOptions?: SQS.ClientConfiguration
    snsOptions?: SNS.ClientConfiguration
  }) {
    this.sqs = new SQS(sqsOptions)
    this.sns = new SNS(snsOptions)
  }

  async createQueue(params: SQS.CreateQueueRequest) {
    return new Promise<SQS.CreateQueueResult>((resolve, reject) => {
      this.sqs.createQueue(params, (err, data) => {
        err ? reject(err) : resolve(data)
      })
    })
  }

  async sendMessage(params: SQS.SendMessageRequest) {
    return new Promise<SQS.SendMessageResult>((resolve, reject) => {
      this.sqs.sendMessage(params, (err, data) => {
        err ? reject(err) : resolve(data)
      })
    })
  }

  async receiveMessage(params: SQS.ReceiveMessageRequest) {
    return new Promise<SQS.ReceiveMessageResult>((resolve, reject) => {
      this.sqs.receiveMessage(params, (err, data) => {
        err ? reject(err) : resolve(data)
      })
    })
  }

  async deleteMessage(params: SQS.DeleteMessageRequest) {
    return new Promise<{}>((resolve, reject) => {
      this.sqs.deleteMessage(params, (err, data) => {
        err ? reject(err) : resolve(data)
      })
    })
  }

  async deleteMessageBatch(params: SQS.DeleteMessageBatchRequest) {
    return new Promise<SQS.DeleteMessageBatchResult>((resolve, reject) => {
      this.sqs.deleteMessageBatch(params, (err, data) => {
        err ? reject(err) : resolve(data)
      })
    })
  }

  async createTopic(params: SNS.CreateTopicInput) {
    return new Promise<SNS.CreateTopicResponse>((resolve, reject) => {
      this.sns.createTopic(params, (err, data) => {
        err ? reject(err) : resolve(data)
      })
    })
  }

  async subscribe(params: SNS.SubscribeInput) {
    return new Promise<SNS.SubscribeResponse>((resolve, reject) => {
      this.sns.subscribe(params, (err, data) => {
        err ? reject(err) : resolve(data)
      })
    })
  }

  async setSubscriptionAttributes(params: SNS.SetSubscriptionAttributesInput) {
    return new Promise<{}>((resolve, reject) => {
      this.sns.setSubscriptionAttributes(params, (err, data) => {
        err ? reject(err) : resolve(data)
      })
    })
  }

  async publish(params: SNS.PublishInput) {
    return new Promise<SNS.PublishResponse>((resolve, reject) => {
      this.sns.publish(params, (err, data) => {
        err ? reject(err) : resolve(data)
      })
    })
  }
}

export class MnsClient implements Client {
  mns: MNS

  constructor(options: {
    accountId: string,
    region: string,
    accessKeyId: string,
    accessKeySecret: string,
    secure?: boolean,
    internal?: boolean,
    vpc?: boolean,
  }) {
    this.mns = new MNS(options)
  }

  async createQueue(params: Types.CreateQueueRequest) {
    return this.mns.createQueue(params)
  }

  async sendMessage(params: Types.SendMessageRequest) {
    return this.mns.sendMessage(params)
  }

  async receiveMessage(params: Types.ReceiveMessageRequest) {
    return this.mns.receiveMessage(params)
  }

  async deleteMessage(params: Types.DeleteMessageRequest) {
    return this.mns.deleteMessage(params)
  }

  async deleteMessageBatch(params: Types.BatchDeleteMessageRequest) {
    return this.mns.batchDeleteMessage(params)
  }

  async createTopic(params: Types.CreateTopicRequest) {
    return this.mns.createTopic(params)
  }

  async subscribe(params: Types.SubscribeRequest) {
    return this.mns.subscribe(params)
  }

  async setSubscriptionAttributes(params: Types.SetSubscriptionAttributesRequest) {
    return this.mns.setSubscriptionAttributes(params)
  }

  async publish(params: Types.PublishMessageRequest) {
    return this.mns.publishMessage(params)
  }
}
