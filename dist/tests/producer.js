"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _init_1 = require("./_init");
const clients = require("../lib/clients");
const producer_1 = require("../lib/producer");
const protocol = require("../lib/protocols/jsonProtocol");
let producer;
_init_1.default.before(t => {
    producer = new producer_1.default(protocol);
});
_init_1.default('should send to topic', t => {
    const mock = t.context.sandbox.mock(clients.sns).expects('publish')
        .once()
        .callsArgWithAsync(1, null, {});
    return producer.sendTopic({
        isReady: true,
        arn: 'arn:sns:test',
    }, { text: 'abc' }).then(() => {
        mock.verify();
        t.deepEqual(mock.firstCall.args[0], {
            TopicArn: 'arn:sns:test',
            Message: '{"text":"abc"}',
        });
    });
});
_init_1.default('should send to queue', t => {
    const mock = t.context.sandbox.mock(clients.sqs).expects('sendMessage')
        .once()
        .callsArgWithAsync(1, null, {});
    return producer.sendQueue({
        isReady: true,
        arn: 'arn:sqs:test',
        queueUrl: 'http://sqs.test.com/q1',
    }, { text: 'abc' }).then(() => {
        mock.verify();
        t.deepEqual(mock.firstCall.args[0], {
            QueueUrl: 'http://sqs.test.com/q1',
            MessageBody: '{"text":"abc"}',
        });
    });
});
//# sourceMappingURL=producer.js.map