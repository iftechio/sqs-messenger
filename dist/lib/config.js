"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.snsArnPrefix = 'arn:sns:test:';
exports.sqsArnPrefix = 'arn:sqs:test';
exports.queueUrlPrefix = 'http://sqs.test/';
exports.resourceNamePrefix = '';
function getSnsArnPrefix() {
    return exports.snsArnPrefix;
}
exports.getSnsArnPrefix = getSnsArnPrefix;
function getSqsArnPrefix() {
    return exports.sqsArnPrefix;
}
exports.getSqsArnPrefix = getSqsArnPrefix;
function getQueueUrlPrefix() {
    return exports.queueUrlPrefix;
}
exports.getQueueUrlPrefix = getQueueUrlPrefix;
function getResourceNamePrefix() {
    return exports.resourceNamePrefix;
}
exports.getResourceNamePrefix = getResourceNamePrefix;
function set(configs) {
    exports.snsArnPrefix = configs.snsArnPrefix || exports.snsArnPrefix;
    exports.sqsArnPrefix = configs.sqsArnPrefix || exports.sqsArnPrefix;
    exports.queueUrlPrefix = configs.queueUrlPrefix || exports.queueUrlPrefix;
    exports.resourceNamePrefix = configs.resourceNamePrefix || exports.resourceNamePrefix;
}
exports.set = set;
//# sourceMappingURL=config.js.map