import { transport as pinoTransport } from "pino";
import type { LokiOptions } from "pino-loki";

export const transport = pinoTransport<LokiOptions>({
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
