import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Demo } from "./demo.js";

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

/** The demo page, its API, and the callback the demo wallets POST to. */
export function createApp(port: number) {
    const demo = new Demo(`http://localhost:${port}/callback`);
    const app = express();
    app.use(express.json());
    app.use(express.static(PUBLIC));

    // One action at a time, so the story stays in order.
    let queue: Promise<unknown> = Promise.resolve();
    const serial = <T>(work: () => Promise<T>) => {
        const next = queue.then(work, work);
        queue = next.catch(() => undefined);
        return next;
    };
    const handle =
        (work: (req: express.Request) => Promise<unknown>) =>
        async (req: express.Request, res: express.Response) => {
            try {
                res.json(await serial(() => work(req)));
            } catch (error) {
                res.status(500).json({
                    error:
                        error instanceof Error ? error.message : String(error),
                });
            }
        };

    // The wallet's POST must not wait behind the action that asked for it.
    app.post("/callback", (req, res) => {
        res.status(demo.receiveSignature(req.body) ? 200 : 404).json({
            ok: true,
        });
    });
    app.get(
        "/api/state",
        handle(() => demo.snapshot()),
    );
    app.post(
        "/api/setup",
        handle(async () => {
            await demo.setup();
            return demo.snapshot();
        }),
    );
    app.post(
        "/api/reset",
        handle(async () => {
            demo.reset();
            await demo.setup();
            return demo.snapshot();
        }),
    );
    app.post(
        "/api/scenario/:id",
        handle(async (req) => {
            const scenario = demo.scenarios[req.params.id];
            if (!scenario) throw new Error(`unknown scenario ${req.params.id}`);
            return {
                outcome: await scenario.run(),
                state: await demo.snapshot(),
            };
        }),
    );
    return { app, demo };
}
