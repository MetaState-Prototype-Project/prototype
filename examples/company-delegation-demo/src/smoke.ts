import type { Server } from "node:http";
import { createApp } from "./app.js";

/**
 * Runs the whole story headless against the local stack and fails if any
 * scenario does not end the way the model says it must.
 */
const port = Number(process.env.DEMO_PORT ?? 5181);
const { app, demo } = createApp(port);
const server: Server = app.listen(port);

const ORDER = [
    "bob-nda",
    "bob-invoice",
    "carol-nda",
    "login-replay",
    "mallory-board",
    "revoke-bob",
];
let failed = 0;
try {
    demo.reset();
    await demo.setup();
    console.log("setup ✓");
    for (const id of ORDER) {
        const outcome = await demo.run(id);
        console.log(
            `${outcome.passed ? "✓" : "✗"} ${demo.scenarios[id].label}: ${outcome.summary}`,
        );
        if (!outcome.passed) failed++;
    }
} catch (error) {
    console.error(error);
    failed++;
} finally {
    server.close();
}
process.exit(failed ? 1 : 0);
