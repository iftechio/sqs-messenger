"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sqs = null;
exports.sns = null;
function set(clients) {
    exports.sqs = clients.sqs || exports.sqs;
    exports.sns = clients.sns || exports.sns;
}
exports.set = set;
//# sourceMappingURL=clients.js.map