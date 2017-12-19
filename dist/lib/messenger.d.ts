/**
 * Construct messenger
 *
 * @param {Object} clients.sqs - Configured SQS client
 * @param {Object} clients.sns - Configured SNS client
 * @param {String} configs.arnPrefix
 * @param {String} configs.queueUrlPrefix
 * @param {String} [configs.resourceNamePrefix=""]
 * @param {Object} [configs.protocol=jsonProtocol]
 * @param {Function} [configs.errorHandler=loggingErrorHandler]
 * @constructor
 */
declare function Messenger(clients: any, configs: any): void;
export default Messenger;
