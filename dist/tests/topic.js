"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _init_1 = require("./_init");
const Promise = require("bluebird");
const sinon = require("sinon");
const clients_1 = require("../lib/clients");
const topic_1 = require("../lib/topic");
const queue_1 = require("../lib/queue");
const config = require("../lib/config");
_init_1.default.before(() => {
    sinon.stub(config, 'getResourceNamePrefix').returns('test_');
    sinon.stub(config, 'getSqsArnPrefix').returns('arn:sqs:test:');
});
_init_1.default.cb.serial('should create topic', t => {
    const mock = t.context.sandbox.mock(clients_1.sns).expects('createTopic').once()
        .withArgs({ Name: 'test_t1' })
        .callsArgWithAsync(1, null, { TopicArn: 'arn:aws-cn:sns:cn-north-1:abc:test_t1' });
    const t1 = new topic_1.default('t1');
    mock.verify();
    t1.on('ready', () => t.end());
});
_init_1.default.serial('should bind queue', t => {
    t.context.sandbox.stub(clients_1.sns, 'createTopic').callsArgWithAsync(1, null, { TopicArn: 'arn:aws-cn:sns:cn-north-1:abc:test_t1' });
    t.context.sandbox.stub(clients_1.sqs, 'createQueue').callsArgWithAsync(1, null, { QueueUrl: 'http://test/tq1' });
    const subStub = t.context.sandbox.mock(clients_1.sns).expects('subscribe').once()
        .callsArgWithAsync(1, null, { SubscriptionArn: 'arn:subscription' });
    const setAttrStub = t.context.sandbox.stub(clients_1.sns, 'setSubscriptionAttributes').callsArgWithAsync(1, null, {});
    const tq = new queue_1.default('tq');
    const t2 = new topic_1.default('t2');
    t2.subscribe(tq);
    return Promise.delay(200)
        .then(() => {
        t.truthy(subStub.calledOnce);
        t.truthy(setAttrStub.calledOnce);
        t.deepEqual(subStub.firstCall.args[0], {
            Protocol: 'sqs',
            TopicArn: 'arn:aws-cn:sns:cn-north-1:abc:test_t1',
            Endpoint: 'arn:sqs:test:test_tq',
        });
        t.deepEqual(setAttrStub.firstCall.args[0], {
            SubscriptionArn: 'arn:subscription',
            AttributeName: 'RawMessageDelivery',
            AttributeValue: 'true',
        });
    });
});
//# sourceMappingURL=topic.js.map