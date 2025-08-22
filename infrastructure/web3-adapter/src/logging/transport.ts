import { transport as pinoTransport } from "pino";
import type { LokiOptions } from "pino-loki";
import dotenv from "dotenv";
import path from "path";

const envPath = path.resolve(__dirname, "../../../../.env")
dotenv.config({ path: envPath})

export const transport = pinoTransport<LokiOptions>({
    target: "pino-loki",
    options: {
        host: process.env.LOKI_URL as string,
        labels: {
            app: "web3-adapter",
        },
        basicAuth: {
            username: process.env.LOKI_USERNAME || "admin",
            password: process.env.LOKI_PASSWORD || "admin",
        },
    },
});
