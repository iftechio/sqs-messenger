"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function encode(msg) {
    return JSON.stringify(msg);
}
exports.encode = encode;
function decode(msg) {
    return JSON.parse(msg.Body);
}
exports.decode = decode;
//# sourceMappingURL=jsonProtocol.js.map