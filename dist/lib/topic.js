"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const debug = require('debug')('sqs-messenger:topic');
const Promise = require("bluebird");
const events_1 = require("events");
const util = require("util");
const clients = require("./clients");
const config = require("./config");
function create(name) {
    debug(`Create topic ${name}`);
    return new Promise((resolve, reject) => {
        clients.sns.createTopic({ Name: name }, (err, data) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(data);
            }
        });
    });
}
function Topic(name) {
    this.name = name;
    this.realName = config.getResourceNamePrefix() + name;
    this.isReady = false;
    create(this.realName).then(data => {
        debug('topic created', data);
        this.arn = data.TopicArn;
        this.isReady = true;
        this.emit('ready');
    }, error => this.emit('error', error));
}
util.inherits(Topic, events_1.EventEmitter);
/**
 * Subscribe queue to topic, queue must be declared already.
 * @param {Queue} queue
 */
Topic.prototype.subscribe = function (queue) {
    return Promise.resolve().then(() => {
        if (this.isReady) {
            return null;
        }
        return new Promise((resolve) => {
            this.on('ready', () => resolve());
        });
    }).then(() => new Promise((resolve, reject) => {
        clients.sns.subscribe({
            Protocol: 'sqs',
            TopicArn: this.arn,
            Endpoint: queue.arn,
        }, (err, data) => {
            if (err) {
                debug(`Error subscribing ${queue.name}(${queue.realName}) to ${this.name}(${this.realName})`);
                reject(err);
            }
            else {
                debug(`Succeed subscribing ${queue.name}(${queue.realName}) to ${this.name}(${this.realName})`);
                resolve(data);
            }
        });
    })).then((data) => new Promise((resolve, reject) => {
        clients.sns.setSubscriptionAttributes({
            SubscriptionArn: data.SubscriptionArn,
            AttributeName: 'RawMessageDelivery',
            AttributeValue: 'true',
        }, err => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    }));
};
exports.default = Topic;
//# sourceMappingURL=topic.js.map