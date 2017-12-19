export let snsArnPrefix = 'arn:sns:test:'

export let sqsArnPrefix = 'arn:sqs:test'

export let queueUrlPrefix = 'http://sqs.test/'

export let resourceNamePrefix = ''

export function getSnsArnPrefix() {
  return snsArnPrefix
}

export function getSqsArnPrefix() {
  return sqsArnPrefix
}

export function getQueueUrlPrefix() {
  return queueUrlPrefix
}

export function getResourceNamePrefix() {
  return resourceNamePrefix
}

export function set(configs) {
  snsArnPrefix = configs.snsArnPrefix || snsArnPrefix
  sqsArnPrefix = configs.sqsArnPrefix || sqsArnPrefix
  queueUrlPrefix = configs.queueUrlPrefix || queueUrlPrefix
  resourceNamePrefix = configs.resourceNamePrefix || resourceNamePrefix
}
