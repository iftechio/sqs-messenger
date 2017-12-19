"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _init_1 = require("./_init");
const clients_1 = require("../lib/clients");
const messenger_1 = require("../lib/messenger");
const queue_1 = require("../lib/queue");
const consumer_1 = require("../lib/consumer");
const topic_1 = require("../lib/topic");
_init_1.default.beforeEach(t => {
    t.context.sandbox.stub(clients_1.sqs, 'createQueue').callsArgWithAsync(1, null, {
        QueueUrl: 'http://test:c'
    });
    t.context.sandbox.stub(clients_1.sqs, 'deleteMessage').callsFake((params, callback) => callback());
    t.context.sandbox.stub(clients_1.sns, 'createTopic').callsArgWithAsync(1, null, { TopicArn: 'arn:aws-cn:sns:cn-north-1:abc:test_t1' });
});
_init_1.default.serial('create queue', t => {
    const sqsMessenger = new messenger_1.default({ sqs: clients_1.sqs }, {
        sqsArnPrefix: 'arn:sqs:test:',
        resourceNamePrefix: 'test_'
    });
    const queue = sqsMessenger.createQueue('myQueue');
    t.true(queue instanceof queue_1.default);
    t.pass();
});
_init_1.default.cb.serial('register one consumer', t => {
    t.context.sandbox.stub(clients_1.sqs, 'receiveMessage').onFirstCall().callsArgWithAsync(1, null, {
        Messages: [{ Body: '{}' }]
    });
    const sqsMessenger = new messenger_1.default({ sqs: clients_1.sqs }, {
        sqsArnPrefix: 'arn:sqs:test:',
        resourceNamePrefix: 'test_'
    });
    sqsMessenger.createQueue('myQueue');
    const consumer = sqsMessenger.on('myQueue', (message, done) => {
        done();
        t.end();
    });
    t.true(consumer instanceof consumer_1.default);
});
_init_1.default.serial.cb.skip('register two consumers', t => {
    const receiveMessage = t.context.sandbox.stub(clients_1.sqs, 'receiveMessage');
    receiveMessage.onFirstCall().callsArgWithAsync(1, null, {
        Messages: [{ Body: '{"n": 1}' }]
    });
    receiveMessage.onSecondCall().callsArgWithAsync(1, null, {
        Messages: [{ Body: '{"n": 2}' }]
    });
    const sqsMessenger = new messenger_1.default({ sqs: clients_1.sqs }, {
        sqsArnPrefix: 'arn:sqs:test:',
        resourceNamePrefix: 'test_'
    });
    sqsMessenger.createQueue('myQueue');
    let numbers = [];
    const consumers = sqsMessenger.on('myQueue', (message, done) => {
        numbers.push(message.n);
        setTimeout(() => {
            done();
            t.deepEqual(numbers, [1, 2]);
            if (message.n == 2) {
                t.end();
            }
        }, 200);
    }, { batchSize: 1, consumers: 2 });
    t.true(consumers.length == 2);
    consumers.forEach(consumer => {
        t.true(consumer instanceof consumer_1.default);
    });
});
_init_1.default.cb.serial('bind topic', t => {
    const topicSubscribeStub = t.context.sandbox.stub(topic_1.default.prototype, 'subscribe').callsFake(() => { });
    const sqsMessenger = new messenger_1.default({ sqs: clients_1.sqs }, {
        sqsArnPrefix: 'arn:sqs:test:',
        resourceNamePrefix: 'test_'
    });
    const topic = new topic_1.default('topic');
    const quene = sqsMessenger.createQueue('myQueue', {
        bindTopic: topic,
    });
    quene.on('ready', () => {
        t.true(topicSubscribeStub.calledOnce);
        t.true(topicSubscribeStub.calledOn(topic));
        t.true(topicSubscribeStub.calledWith(quene));
        t.end();
    });
});
_init_1.default.cb.serial('bind topics', t => {
    const topicSubscribeStub = t.context.sandbox.stub(topic_1.default.prototype, 'subscribe').callsFake(() => { });
    const sqsMessenger = new messenger_1.default({ sqs: clients_1.sqs }, {
        sqsArnPrefix: 'arn:sqs:test:',
        resourceNamePrefix: 'test_'
    });
    const topic1 = new topic_1.default('topic1');
    const topic2 = new topic_1.default('topic2');
    const topic3 = new topic_1.default('topic3');
    const quene = sqsMessenger.createQueue('myQueue', {
        bindTopics: [topic1, topic2, topic3],
    });
    quene.on('ready', () => {
        t.true(topicSubscribeStub.calledThrice);
        t.true(topicSubscribeStub.calledOn(topic1));
        t.true(topicSubscribeStub.calledOn(topic2));
        t.true(topicSubscribeStub.calledOn(topic3));
        t.true(topicSubscribeStub.calledWith(quene));
        t.end();
    });
});
_init_1.default.cb.serial('send empty queue', t => {
    const sqsMessenger = new messenger_1.default({ sqs: clients_1.sqs }, {
        sqsArnPrefix: 'arn:sqs:test:',
        resourceNamePrefix: 'test_'
    });
    t.throws(() => sqsMessenger.sendQueueMessage('foo', {}), 'Queue[foo] not found');
    t.end();
});
//# sourceMappingURL=messenger.js.map