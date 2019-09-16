import { SQS, SNS } from 'aws-sdk'
import * as MNS from '@ruguoapp/mns-node-sdk'

export interface Client {
  /**
   * Create a queue.
   */
  createQueue(params: {
    QueueName: string
    Attributes?: {
      MaximumMessageSize: number
      VisibilityTimeout: number
      DelaySeconds: number
      Policy?: string
      RedrivePolicy?: string
      MessageRetentionPeriod?: number
      PollingWaitSeconds?: number
      LoggingEnabled?: boolean
    }
  }): Promise<{ Locator?: string }>

  /**
   * Send a message.
   */
  sendMessage(params: {
    Locator: string
    MessageBody: string
    DelaySeconds?: number
    Priority?: number
  }): Promise<{
    MessageId?: string
    MD5OfMessageBody?: string
  }>

  /**
   * Receive a batch of messages.
   */
  receiveMessageBatch(params: {
    Locator: string
    MaxNumberOfMessages: number
    WaitTimeSeconds: number
    VisibilityTimeout: number
  }): Promise<{
    Messages?: {
      MessageId?: string
      ReceiptHandle?: string
      MD5OfBody?: string
      Body?: string
    }[]
  }>

  /**
   * Delete a message.
   */
  deleteMessage(params: { Locator: string; ReceiptHandle: string }): Promise<void>

  /**
   * Delete a batch of messages.
   */
  deleteMessageBatch(params: {
    Locator: string
    Entries: {
      Id: string
      ReceiptHandle: string
    }[]
  }): Promise<void>

  /**
   * Create a topic.
   */
  createTopic(params: {
    TopicName: string
    Attributes?: {
      MaximumMessageSize?: number
      LoggingEnabled?: boolean
    }
  }): Promise<{ Locator?: string }>

  /**
   * Subscribe queue to topic.
   */
  subscribe(params: {
    TopicLocator: string
    Protocol?: string
    Endpoint: string
  }): Promise<{ SubscribeLocator?: string }>

  /**
   * Set subscription attributes.
   */
  setSubscriptionAttributes(params: {
    SubscribeLocator: string
    AttributeName?: string
    AttributeValue: string
  }): Promise<void>

  /**
   * Send message to topic.
   */
  publish(params: {
    Locator: string
    Message: string
  }): Promise<{ MessageId?: string; MD5OfMessageBody?: string }>
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

  async createQueue(params: {
    QueueName: string
    Attributes: {
      MaximumMessageSize: number
      VisibilityTimeout: number
      DelaySeconds: number
      Policy?: string
      RedrivePolicy?: string
    }
  }) {
    const createQueueRequest: SQS.CreateQueueRequest = {
      QueueName: params.QueueName,
    }
    if (params.Attributes) {
      createQueueRequest.Attributes = {
        MaximumMessageSize: params.Attributes.MaximumMessageSize.toString(),
        VisibilityTimeout: params.Attributes.VisibilityTimeout.toString(),
        DelaySeconds: params.Attributes.DelaySeconds.toString(),
      }
      if (params.Attributes.Policy) {
        createQueueRequest.Attributes.Policy = params.Attributes.Policy
      }
      if (params.Attributes.RedrivePolicy) {
        createQueueRequest.Attributes.RedrivePolicy = params.Attributes.RedrivePolicy
      }
    }
    return new Promise<{ Locator?: string }>((resolve, reject) => {
      this.sqs.createQueue(createQueueRequest, (err, data) => {
        err ? reject(err) : resolve({ Locator: data.QueueUrl })
      })
    })
  }

  async sendMessage(params: {
    Locator: string
    MessageBody: string
    DelaySeconds?: number
    Priority?: number
  }) {
    const sendMessageParams: SQS.SendMessageRequest = {
      QueueUrl: params.Locator,
      MessageBody: params.MessageBody,
      DelaySeconds: params.DelaySeconds,
    }
    return new Promise<SQS.SendMessageResult>((resolve, reject) => {
      this.sqs.sendMessage(sendMessageParams, (err, data) => {
        err ? reject(err) : resolve(data)
      })
    })
  }

  async receiveMessageBatch(params: {
    Locator: string
    MaxNumberOfMessages: number
    WaitTimeSeconds: number
    VisibilityTimeout: number
  }) {
    const receiveMessageParams: SQS.ReceiveMessageRequest = {
      QueueUrl: params.Locator,
      MaxNumberOfMessages: params.MaxNumberOfMessages,
      WaitTimeSeconds: params.WaitTimeSeconds,
      VisibilityTimeout: params.VisibilityTimeout,
    }
    return new Promise<SQS.ReceiveMessageResult>((resolve, reject) => {
      this.sqs.receiveMessage(receiveMessageParams, (err, data) => {
        err ? reject(err) : resolve(data)
      })
    })
  }

  async deleteMessage(params: { Locator: string; ReceiptHandle: string }) {
    const deleteMessageParams: SQS.DeleteMessageRequest = {
      QueueUrl: params.Locator,
      ReceiptHandle: params.ReceiptHandle,
    }
    return new Promise<void>((resolve, reject) => {
      this.sqs.deleteMessage(deleteMessageParams, err => {
        err ? reject(err) : resolve()
      })
    })
  }

  async deleteMessageBatch(params: {
    Locator: string
    Entries: {
      Id: string
      ReceiptHandle: string
    }[]
  }) {
    const deleteMessageBatchParams: SQS.DeleteMessageBatchRequest = {
      QueueUrl: params.Locator,
      Entries: params.Entries,
    }
    return new Promise<void>((resolve, reject) => {
      this.sqs.deleteMessageBatch(deleteMessageBatchParams, err => {
        err ? reject(err) : resolve()
      })
    })
  }

  async createTopic(params: { TopicName: string }) {
    const createTopicParams: SNS.CreateTopicInput = {
      Name: params.TopicName,
    }
    return new Promise<{ Locator?: string }>((resolve, reject) => {
      this.sns.createTopic(createTopicParams, (err, data) => {
        err ? reject(err) : resolve({ Locator: data.TopicArn })
      })
    })
  }

  async subscribe(params: { TopicLocator: string; Protocol: string; Endpoint: string }) {
    const subscribeParams: SNS.SubscribeInput = {
      TopicArn: params.TopicLocator,
      Protocol: params.Protocol,
      Endpoint: params.Endpoint,
    }
    return new Promise<{ SubscribeLocator?: string }>((resolve, reject) => {
      this.sns.subscribe(subscribeParams, (err, data) => {
        err ? reject(err) : resolve({ SubscribeLocator: data.SubscriptionArn })
      })
    })
  }

  async setSubscriptionAttributes(params: {
    SubscribeLocator: string
    AttributeName: string
    AttributeValue: string
  }) {
    const setSubscriptionAttributesParams: SNS.SetSubscriptionAttributesInput = {
      SubscriptionArn: params.SubscribeLocator,
      AttributeName: params.AttributeName,
      AttributeValue: params.AttributeValue,
    }
    return new Promise<void>((resolve, reject) => {
      this.sns.setSubscriptionAttributes(setSubscriptionAttributesParams, err => {
        err ? reject(err) : resolve()
      })
    })
  }

  async publish(params: { Locator: string; Message: string }) {
    const publishParams: SNS.PublishInput = {
      TopicArn: params.Locator,
      Message: params.Message,
    }
    return new Promise<SNS.PublishResponse>((resolve, reject) => {
      this.sns.publish(publishParams, (err, data) => {
        err ? reject(err) : resolve(data)
      })
    })
  }
}

export class MnsClient implements Client {
  mns: MNS.Client

  constructor(options: {
    accountId: string
    region: string
    accessKeyId: string
    accessKeySecret: string
    secure?: boolean
    internal?: boolean
    vpc?: boolean
  }) {
    this.mns = new MNS.Client(options)
  }

  async createQueue(params: {
    QueueName: string
    Attributes?: {
      MaximumMessageSize: number
      VisibilityTimeout: number
      DelaySeconds: number
      MessageRetentionPeriod?: number
      PollingWaitSeconds?: number
      LoggingEnabled?: boolean
    }
  }) {
    const createQueueRequest: MNS.Types.CreateQueueRequest = {
      QueueName: params.QueueName,
    }
    if (params.Attributes) {
      createQueueRequest.Attributes = {
        MaximumMessageSize: params.Attributes!.MaximumMessageSize,
        VisibilityTimeout: params.Attributes!.VisibilityTimeout,
        DelaySeconds: params.Attributes!.DelaySeconds,
        MessageRetentionPeriod: params.Attributes!.MessageRetentionPeriod,
        PollingWaitSeconds: params.Attributes!.PollingWaitSeconds,
        LoggingEnabled: params.Attributes!.LoggingEnabled,
      }
    }
    await this.mns.createQueue(createQueueRequest)
    return { Locator: params.QueueName }
  }

  async sendMessage(params: {
    Locator: string
    MessageBody: string
    DelaySeconds?: number
    Priority?: number
  }) {
    const sendMessageParams: MNS.Types.SendMessageRequest = {
      QueueName: params.Locator,
      Payloads: {
        MessageBody: params.MessageBody,
        DelaySeconds: params.DelaySeconds,
        Priority: params.Priority,
      },
    }
    const data = await this.mns.sendMessage(sendMessageParams)
    return {
      MessageId: data.MessageId,
      MD5OfMessageBody: data.MessageBodyMD5,
    }
  }

  async receiveMessageBatch(params: {
    Locator: string
    MaxNumberOfMessages: number
    WaitTimeSeconds: number
    VisibilityTimeout: number
  }) {
    const receiveMessageParams: MNS.Types.BatchReceiveMessageRequest = {
      QueueName: params.Locator,
      NumOfMessages: params.MaxNumberOfMessages,
      WaitSeconds: params.WaitTimeSeconds,
    }
    const data = await this.mns.batchReceiveMessage(receiveMessageParams)
    return {
      Messages: data.map(message => ({
        MessageId: message.MessageId,
        ReceiptHandle: message.ReceiptHandle,
        MD5OfBody: message.MessageBodyMD5,
        Body: message.MessageBody,
      })),
    }
  }

  async deleteMessage(params: { Locator: string; ReceiptHandle: string }) {
    const deleteMessageParams: MNS.Types.DeleteMessageRequest = {
      QueueName: params.Locator,
      ReceiptHandle: params.ReceiptHandle,
    }
    return this.mns.deleteMessage(deleteMessageParams)
  }

  async deleteMessageBatch(params: {
    Locator: string
    Entries: {
      Id: string
      ReceiptHandle: string
    }[]
  }) {
    const deleteMessageBatchParams: MNS.Types.BatchDeleteMessageRequest = {
      QueueName: params.Locator,
      ReceiptHandles: params.Entries.map(message => message.ReceiptHandle),
    }
    await this.mns.batchDeleteMessage(deleteMessageBatchParams)
    return
  }

  async createTopic(params: MNS.Types.CreateTopicRequest) {
    await this.mns.createTopic(params)
    return { Locator: params.TopicName }
  }

  async subscribe(params: { TopicLocator: string; Endpoint: string }) {
    const subscribeParams: MNS.Types.SubscribeRequest = {
      TopicName: params.TopicLocator,
      SubscriptionName: `${params.TopicLocator}-${params.Endpoint}`,
      Attributes: {
        Endpoint: params.Endpoint,
      },
    }
    await this.mns.subscribe(subscribeParams)
    return { SubscribeLocator: `${params.TopicLocator}-${params.Endpoint}` }
  }

  async setSubscriptionAttributes() {
    return
  }

  async publish(params: { Locator: string; Message: string }) {
    const publishParams: MNS.Types.PublishMessageRequest = {
      TopicName: params.Locator,
      Payloads: {
        MessageBody: params.Message,
      },
    }
    const data = await this.mns.publishMessage(publishParams)
    return { MessageId: data.MessageId, MD5OfMessageBody: data.MessageBodyMD5 }
  }
}
