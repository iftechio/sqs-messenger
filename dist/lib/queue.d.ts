/**
 * Construct an SQS queue.
 * @param {String} name
 * @param {Boolean} [opts.withDeadLetter=false]
 * @param {String} [opts.deadLetterQueueName]
 * @param {Number} [opts.visibilityTimeout=30]
 * @param {Number} [opts.maximumMessageSize=262144] - 256KB
 * @param {Number} [opts.isDeadLetterQueue=false]
 * @param {Number} [opts.maxReceiveCount=5]
 * @constructor
 */
declare function Queue(name: any, opts?: any): void;
export default Queue;
