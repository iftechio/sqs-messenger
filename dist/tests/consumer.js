"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _init_1 = require("./_init");
const sinon = require("sinon");
const Promise = require("bluebird");
const clients_1 = require("../lib/clients");
const queue_1 = require("../lib/queue");
_init_1.default.before(t => {
    sinon.stub(clients_1.sqs, 'createQueue')
        .callsArgWithAsync(1, null, { QueueUrl: 'http://test:c' });
});
_init_1.default.cb.serial('should receive message', t => {
    const c1 = new queue_1.default('c1');
    t.context.sandbox.stub(clients_1.sqs, 'receiveMessage')
        .onFirstCall()
        .callsArgWithAsync(1, null, { Messages: [{ Body: '{"text":"hahaha"}' }] });
    c1.onMessage((message, done) => {
        t.deepEqual(message, { text: 'hahaha' });
        t.truthy(done);
        t.end();
    });
});
_init_1.default.cb.serial('should delete message on done', t => {
    const c2 = new queue_1.default('c2');
    t.context.sandbox.stub(clients_1.sqs, 'receiveMessage')
        .onFirstCall()
        .callsArgWithAsync(1, null, { Messages: [{ ReceiptHandle: '1', Body: '{"text":"hahaha"}' }] });
    const mock = t.context.sandbox.mock(clients_1.sqs).expects('deleteMessage')
        .once()
        .withArgs({
        QueueUrl: 'http://test:c',
        ReceiptHandle: '1',
    })
        .callsArgWithAsync(1, null, null);
    c2.onMessage((message, done) => {
        t.deepEqual(message, { text: 'hahaha' });
        done();
    });
    setTimeout(() => {
        mock.verify();
        t.end();
    }, 200);
});
_init_1.default.serial('should handle consumer handler timeout', t => {
    const c3 = new queue_1.default('c3');
    t.context.sandbox.stub(clients_1.sqs, 'receiveMessage')
        .onFirstCall()
        .callsArgWithAsync(1, null, { Messages: [{ Body: '{"text":"hahaha"}' }] });
    const consumer = c3.onMessage((message, done) => {
        // do nothing, wait for timeout
    }, { visibilityTimeout: 1 });
    return new Promise((resolve, reject) => {
        consumer.on('error', (msg, err) => {
            try {
                t.is(msg, 'Consumer[c3] handler error');
            }
            catch (e) {
                reject(e);
            }
            resolve();
        });
    }).timeout(2000);
});
_init_1.default.cb.serial('should delete batch messages on done', t => {
    const c4 = new queue_1.default('c4');
    t.context.sandbox.stub(clients_1.sqs, 'receiveMessage')
        .onFirstCall()
        .callsArgWithAsync(1, null, {
        Messages: [
            { ReceiptHandle: '1', Body: '{"text":"hahaha1"}' },
            { ReceiptHandle: '2', Body: '{"text":"hahaha2"}' },
            { ReceiptHandle: '3', Body: '{"text":"hahaha3"}' },
            { ReceiptHandle: '4', Body: '{"text":"hahaha4"}' },
        ]
    });
    const mock = t.context.sandbox.mock(clients_1.sqs).expects('deleteMessageBatch')
        .once()
        .withArgs({
        QueueUrl: 'http://test:c',
        Entries: [
            { Id: '0', ReceiptHandle: '1' },
            { Id: '1', ReceiptHandle: '2' },
            { Id: '2', ReceiptHandle: '3' },
            { Id: '3', ReceiptHandle: '4' },
        ]
    })
        .callsArgWithAsync(1, null, null);
    c4.onMessage((messages, done) => {
        t.deepEqual(messages, [
            { text: 'hahaha1' },
            { text: 'hahaha2' },
            { text: 'hahaha3' },
            { text: 'hahaha4' },
        ]);
        done();
    }, { batchHandle: true });
    setTimeout(() => {
        mock.verify();
        t.end();
    }, 200);
});
//# sourceMappingURL=consumer.js.map