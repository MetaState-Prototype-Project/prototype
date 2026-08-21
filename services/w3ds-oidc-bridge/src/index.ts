import { verifyLoginSignature } from "@metastate-foundation/auth";
import { createApp } from "./app.js";
import { createClientRegistry } from "./clients.js";
import { ConfigError, getConfig } from "./config.js";
import type { BridgeContext } from "./context.js";
import { KeyError, createKeyring } from "./keys.js";
import { createStore } from "./store.js";
import { createSessionStreams } from "./w3ds/events.js";

/** How often abandoned sessions and codes are reaped. Reads expire lazily anyway. */
const SWEEP_INTERVAL_MS = 60_000;

async function main(): Promise<void> {
    // Anything wrong with the environment or the key stops the process here,
    // rather than surfacing as a failed login later, when the symptom no longer
    // points at the cause.
    const config = getConfig();

    const ctx: BridgeContext = {
        config,
        keyring: await createKeyring({
            signingKey: config.signingKey,
            keyId: config.keyId,
            issuer: config.publicUrl,
        }),
        store: createStore(),
        clients: createClientRegistry(config),
        streams: createSessionStreams(),
        verifyLogin: ({ ename, session, signature }) =>
            verifyLoginSignature({
                eName: ename,
                signature,
                session,
                registryBaseUrl: config.registryUrl,
            }),
    };

    const sweeper = setInterval(() => ctx.store.sweep(), SWEEP_INTERVAL_MS);
    sweeper.unref();

    const server = createApp(ctx).listen(config.port, () => {
        console.log(`w3ds-oidc-bridge listening on :${config.port}`);
        // The issuer is echoed because goth compares it byte for byte, and a
        // trailing slash or a wrong host is the failure hardest to spot from the
        // Forgejo side.
        console.log(`  issuer   ${config.publicUrl}`);
        console.log(`  registry ${config.registryUrl}`);
        if (!config.publicUrl.startsWith("https://")) {
            console.warn(
                "  WARNING: serving over http. goth does not verify the ID token signature, so this is only safe on a host shared with GitW3.",
            );
        }
    });

    const shutdown = () => {
        clearInterval(sweeper);
        ctx.streams.closeAll();
        server.close(() => process.exit(0));
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
}

main().catch((error: unknown) => {
    // A configuration or key problem is the operator's to fix, so say what is
    // wrong without a stack trace they cannot act on.
    if (error instanceof ConfigError || error instanceof KeyError) {
        console.error(`w3ds-oidc-bridge cannot start: ${error.message}`);
        process.exit(1);
    }
    console.error(error);
    process.exit(1);
});
