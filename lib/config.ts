class Config {
  snsArnPrefix = 'arn:sns:test:'
  sqsArnPrefix = 'arn:sqs:test'
  queueUrlPrefix = 'http://sqs.test/'
  resourceNamePrefix = ''

  constructor(
    conf: {
      snsArnPrefix?: string
      sqsArnPrefix?: string
      queueUrlPrefix?: string
      resourceNamePrefix?: string
    } = {},
  ) {
    this.snsArnPrefix = conf.snsArnPrefix || this.snsArnPrefix
    this.sqsArnPrefix = conf.sqsArnPrefix || this.sqsArnPrefix
    this.queueUrlPrefix = conf.queueUrlPrefix || this.queueUrlPrefix
    this.resourceNamePrefix = conf.resourceNamePrefix || this.resourceNamePrefix
  }
}

export default Config
