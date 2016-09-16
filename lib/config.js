module.exports = {
  snsArnPrefix: 'arn:sns:test:',
  sqsArnPrefix: 'arn:sqs:test',
  queueUrlPrefix: 'http://sqs.test/',
  resourceNamePrefix: '',
  getSnsArnPrefix() {
    return this.snsArnPrefix
  },
  getSqsArnPrefix() {
    return this.sqsArnPrefix
  },
  getQueueUrlPrefix() {
    return this.queueUrlPrefix
  },
  getResourceNamePrefix() {
    return this.resourceNamePrefix
  },
  set(configs) {
    this.snsArnPrefix = configs.snsArnPrefix || this.snsArnPrefix
    this.sqsArnPrefix = configs.sqsArnPrefix || this.sqsArnPrefix
    this.queueUrlPrefix = configs.queueUrlPrefix || this.queueUrlPrefix
    this.resourceNamePrefix = configs.resourceNamePrefix || this.resourceNamePrefix
  },
}
