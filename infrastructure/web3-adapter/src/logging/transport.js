"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transport = void 0;
const pino_1 = require("pino");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const envPath = path_1.default.resolve(__dirname, "../../../../.env");
dotenv_1.default.config({ path: envPath });
exports.transport = (0, pino_1.transport)({
    target: "pino-loki",
    options: {
        host: process.env.LOKI_URL,
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