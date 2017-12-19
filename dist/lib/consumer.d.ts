/**
 * @param {Queue} queue
 * @param {Function} handler
 * @param {Number} [opts.batchSize=10]
 * @param {Number} [opts.visibilityTimeout=30]
 * @param {Boolean} [opts.batchHandle=false]
 * @param {Object} [opts.protocol=jsonProtocol]
 * @constructor
 */
declare function Consumer(queue: any, handler: any, opts: any): void;
export default Consumer;
