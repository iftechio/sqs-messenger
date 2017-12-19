"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _init_1 = require("./_init");
const Promise = require("bluebird");
const sinon = require("sinon");
const clients_1 = require("../lib/clients");
const queue_1 = require("../lib/queue");
const config = require("../lib/config");
_init_1.default.before(t => {
    sinon.stub(config, 'getResourceNamePrefix').returns('test_');
    sinon.stub(config, 'getSqsArnPrefix').returns('arn:sqs:test:');
});
_init_1.default.serial('should create queue', t => {
    const mock = t.context.sandbox.mock(clients_1.sqs).expects('createQueue')
        .once()
        .callsArgWithAsync(1, null, {
        QueueUrl: 'http://test_q1',
    });
    const q1 = new queue_1.default('q1');
    return Promise.delay(200).then(() => {
        mock.verify();
        const expectPolicy = JSON.stringify({
            Version: '2012-10-17',
            Id: 'arn:sqs:test:test_q1/SQSDefaultPolicy',
            Statement: [
                {
                    Sid: '1',
                    Effect: 'Allow',
                    Principal: '*',
                    Action: 'SQS:SendMessage',
                    Resource: 'arn:sqs:test:test_q1',
                },
            ],
        });
        t.deepEqual(mock.firstCall.args[0], {
            QueueName: 'test_q1',
            Attributes: {
                VisibilityTimeout: '30',
                MaximumMessageSize: '262144',
                Policy: expectPolicy,
            },
        });
    });
});
_init_1.default.serial('should create deadletter queue', t => {
    const mock = t.context.sandbox.mock(clients_1.sqs).expects('createQueue')
        .twice()
        .callsArgWithAsync(1, null, {
        QueueUrl: 'http://test_q1',
    });
    const q2 = new queue_1.default('q2', { withDeadLetter: true });
    return Promise.delay(200).then(() => {
        mock.verify();
        t.deepEqual(mock.firstCall.args[0], {
            QueueName: 'test_q2-dl',
        });
        const expectPolicy = JSON.stringify({
            Version: '2012-10-17',
            Id: 'arn:sqs:test:test_q2/SQSDefaultPolicy',
            Statement: [
                {
                    Sid: '1',
                    Effect: 'Allow',
                    Principal: '*',
                    Action: 'SQS:SendMessage',
                    Resource: 'arn:sqs:test:test_q2',
                },
            ],
        });
        t.deepEqual(mock.secondCall.args[0], {
            QueueName: 'test_q2',
            Attributes: {
                VisibilityTimeout: '30',
                MaximumMessageSize: '262144',
                Policy: expectPolicy,
                RedrivePolicy: '{"maxReceiveCount":"5", "deadLetterTargetArn":"arn:sqs:test:test_q2-dl"}',
            },
        });
    });
});
function shutdownMacro(t, input, expected) {
    const sandbox = t.context.sandbox;
    sandbox.stub(clients_1.sqs, 'createQueue').callsArgWithAsync(1, null, {
        QueueUrl: 'http://test:c'
    });
    sandbox.stub(clients_1.sqs, 'receiveMessage').onFirstCall().callsArgWithAsync(1, null, {
        Messages: [{ Body: '{}' }]
    });
    sandbox.stub(clients_1.sqs, 'deleteMessage').callsFake((params, callback) => callback());
    const queue = new queue_1.default('q');
    return Promise.delay(200).then(() => {
        const spy = sinon.spy();
        const consumer = queue.onMessage((message, done) => {
            setTimeout(() => {
                spy();
                done();
            }, 500);
        });
        const startTime = Date.now();
        return queue.shutdown(input).then(() => {
            t.true(Date.now() - startTime < 1000);
            t.false(consumer.running);
            t.is(spy.called, expected);
        });
    });
}
_init_1.default.serial('should shutdown gracefully with timeout', shutdownMacro, 10000, true);
_init_1.default.serial('should shutdown violently without timeout', shutdownMacro, 0, false);
//# sourceMappingURL=queue.js.map