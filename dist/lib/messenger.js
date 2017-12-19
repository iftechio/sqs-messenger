"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Promise = require("bluebird");
const clientsHolder = require("./clients");
const config = require("./config");
const producer_1 = require("./producer");
const queue_1 = require("./queue");
const topic_1 = require("./topic");
const jsonProtocol = require("./protocols/jsonProtocol");
const TYPES = {
    TOPIC: 'topic',
    QUEUE: 'queue',
};
const queueMap = {};
const topicMap = {};
/**
 * Default error handler, print error to console.
 * @param args
 */
function loggingErrorHandler(...args) {
    console.error.apply(undefined, ['[sqs-messenger]'].concat(Array.prototype.map.call(args, arg => (arg instanceof Error ? arg.stack : arg))));
}
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
function Messenger(clients, configs) {
    if (!clients.sqs) {
        throw Error('SQS client required');
    }
    clientsHolder.set(clients);
    config.set(configs || {});
    this.protocol = configs.protocol || jsonProtocol;
    this.producer = new producer_1.default(this.protocol);
    this.errorHandler = configs.errorHandler || loggingErrorHandler;
    this.sendTopicMessage = this.send.bind(this, TYPES.TOPIC);
    this.sendQueueMessage = this.send.bind(this, TYPES.QUEUE);
}
/**
 * Register a message handler on a queue
 *
 * @param {Queue} queue
 * @param {Function} handler
 * @param {Number} [opts.batchSize=10]
 * @param {Number} [opts.consumers=1]
 * @param {Boolean} [opts.batchHandle=false]
 */
Messenger.prototype.on = function (queue, handler, opts) {
    if (typeof queue === 'string') {
        queue = queueMap[queue];
    }
    if (!queue) {
        throw new Error('Queue not found');
    }
    opts = opts || {};
    opts.protocol = this.protocol;
    let consumers = [];
    const consumersNum = opts.consumers || 1;
    for (let i = 0; i < consumersNum; i++) {
        const consumer = queue.onMessage(handler, opts);
        consumer.on('error', this.errorHandler);
        consumers.push(consumer);
    }
    return consumers.length > 1 ? consumers : consumers[0];
};
/**
 * Register error handler.
 *
 * @param {Function} errHandler
 */
Messenger.prototype.onError = function (errHandler) {
    this.errorHandler = errHandler;
};
/**
 * Send message to specific topic or queue, messages will be dropped
 * if SQS queue or SNS topic in the process of declaring.
 *
 * @param {String} [type='topic'] - 'topic' or 'queue'
 * @param {String} key - resource key, topic or queue name
 * @param {Object} msg - the payload to send
 * @param {Object} [options] - options for sqs message
 * @param {Number} options.DelaySeconds
 * @returns {Promise}
 */
Messenger.prototype.send = function (type, key, msg, options) {
    if (arguments.length < 2) {
        return Promise.reject(new Error('Invalid parameter list'));
    }
    if (arguments.length === 2) {
        return this.send(TYPES.QUEUE, type, key);
    }
    // send with options
    if (arguments.length === 3 && typeof key === 'object') {
        return this.send(TYPES.QUEUE, type, key, msg);
    }
    if (type === TYPES.TOPIC) {
        const topic = topicMap[key];
        if (!topic) {
            throw new Error(`Topic[${key}] not found`);
        }
        return this.producer.sendTopic(topic, msg);
    }
    else if (type === TYPES.QUEUE) {
        const queue = queueMap[key];
        if (!queue) {
            throw new Error(`Queue[${key}] not found`);
        }
        return this.producer.sendQueue(queue, msg, options);
    }
    return Promise.reject(new Error(`Resource type not supported for ${type}`));
};
/**
 * Create a topic with specific name, will declare the SNS topic if not exists
 *
 * @param {String} name - the topic name, internal name could be
 *                        different from this depend on environment
 * @returns {Topic}
 */
Messenger.prototype.createTopic = function (name) {
    const topic = new topic_1.default(name);
    topic.on('error', this.errorHandler);
    topicMap[name] = topic;
    return topic;
};
/**
 * Create a queue with specific name, will declare the SQS queue if not exists
 *
 * @param {String} name - the queue name, internal name could be different
 *                        from this depend on environment
 * @param {Object} [opts] - Queue options
 * @param {Topic} [opts.bindTopic] - the topic to subscribe on
 * @param {Array} [opts.bindTopics] - multiple topics to subscribe on
 * @param {Boolean} [opts.withDeadLetter=false]
 * @param {String} [opts.deadLetterQueueName]
 * @param {Number} [opts.visibilityTimeout=30]
 * @param {Number} [opts.maximumMessageSize=262144] - 256KB
 * @returns {Queue}
 */
Messenger.prototype.createQueue = function (name, opts) {
    const queue = new queue_1.default(name, opts);
    queue.on('error', this.errorHandler);
    opts = opts || {};
    if (opts.bindTopics || opts.bindTopic) {
        opts.bindTopics = opts.bindTopics || [opts.bindTopic];
        // Wait for queue being ready, topic will handle itself if is not ready
        if (queue.isReady) {
            opts.bindTopics.forEach(topic => topic.subscribe(queue));
        }
        else {
            queue.on('ready', () => opts.bindTopics.forEach(topic => topic.subscribe(queue)));
        }
    }
    queueMap[name] = queue;
    return queue;
};
/**
 * Gracefully shutdown each queue within `timeout`
 *
 * @param {Number} timeout
 * @returns {Promise}
 */
Messenger.prototype.shutdown = function (timeout) {
    const queues = Object.keys(queueMap).map(queueName => queueMap[queueName]);
    return Promise.map(queues, (queue) => {
        return queue.shutdown(timeout);
    });
};
exports.default = Messenger;
//# sourceMappingURL=messenger.js.map