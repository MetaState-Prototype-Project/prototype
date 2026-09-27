import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createApp, createDeps } from "./app.js";
import { loadConfig } from "./config.js";
import { loadSigningKeys } from "./keys.js";
import { log } from "./log.js";
import { startSweeper } from "./store/sweeper.js";

loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

async function start() {
    const config = loadConfig();
    const keys = await loadSigningKeys({
        jwk: config.signingKeyJwk,
        production: config.production,
    });
    const deps = createDeps(config, keys);
    const app = createApp(deps);
    const stopSweeper = startSweeper(
        [deps.sessions, deps.codes, deps.tokens],
        deps.now,
    );

    const server = app.listen(config.port, () => {
        log.info(
            `listening on ${config.port} as ${config.issuer} for ${config.clients.length} client(s)`,
        );
    });

    const shutdown = (signal: string) => {
        log.info(`${signal} received, shutting down`);
        stopSweeper();
        server.close(() => process.exit(0));
        // Open SSE streams would otherwise hold the server open.
        server.closeAllConnections();
        setTimeout(() => process.exit(1), 5000).unref();
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error) => {
    log.error("failed to start:", error instanceof Error ? error.message : error);
    process.exit(1);
});
