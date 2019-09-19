class Config {
  sqsArnPrefix = 'arn:sqs:test'
  queueUrlPrefix = 'http://sqs.test/'
  resourceNamePrefix = ''

  constructor(
    conf: {
      sqsArnPrefix?: string
      queueUrlPrefix?: string
      resourceNamePrefix?: string
    } = {},
  ) {
    this.sqsArnPrefix = conf.sqsArnPrefix || this.sqsArnPrefix
    this.queueUrlPrefix = conf.queueUrlPrefix || this.queueUrlPrefix
    this.resourceNamePrefix = conf.resourceNamePrefix || this.resourceNamePrefix
  }
}

export default Config
