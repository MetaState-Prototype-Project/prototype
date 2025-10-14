"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const transport_1 = require("./transport");
exports.logger = (0, pino_1.default)(transport_1.transport);
//# sourceMappingURL=logger.js.map