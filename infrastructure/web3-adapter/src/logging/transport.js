"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transport = void 0;
const pino_1 = require("pino");
exports.transport = (0, pino_1.transport)({
    target: "pino-loki",
    options: {
        host: process.env.LOKI_URL || "http://localhost:3100",
        labels: {
            app: "web3-adapter",
        },
        basicAuth: {
            username: process.env.LOKI_USERNAME || "admin",
            password: process.env.LOKI_PASSWORD || "admin",
        },
    },
});
//# sourceMappingURL=transport.js.map