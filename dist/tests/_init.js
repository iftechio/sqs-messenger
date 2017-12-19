"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ava_1 = require("ava");
require("source-map-support/register");
const AWS = require("aws-sdk");
const sinon = require("sinon");
const clients = require("../lib/clients");
const sqs = new AWS.SQS({
    region: 'cn-north-1',
    apiVersion: '2012-11-05',
});
const sns = new AWS.SNS({
    region: 'cn-north-1',
    apiVersion: '2010-03-31',
});
clients.set({
    sqs, sns,
});
ava_1.default.beforeEach(t => {
    t.context.sandbox = sinon.sandbox.create();
});
ava_1.default.afterEach.always(t => {
    t.context.sandbox.restore();
});
exports.default = ava_1.default;
//# sourceMappingURL=_init.js.map