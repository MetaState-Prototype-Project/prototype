import { afterEach, describe, expect, it, vi } from "vitest";
import { config } from "../config";
import { DeliveryEngine } from "./DeliveryEngine";

class ProbeEngine extends DeliveryEngine {
    ticks = 0;

    protected override async writeHeartbeat(): Promise<void> {
        // This test isolates scheduler recovery from the database.
    }

    protected override async tick(): Promise<void> {
        this.ticks += 1;
        if (this.ticks === 1) {
            await new Promise<void>(() => undefined);
        }
    }
}

describe("DeliveryEngine scheduler", () => {
    const originalPoll = config.deliveryPollMs;
    const originalDeadline = config.deliveryBatchTimeoutMs;

    afterEach(() => {
        config.deliveryPollMs = originalPoll;
        config.deliveryBatchTimeoutMs = originalDeadline;
        vi.restoreAllMocks();
    });

    it("continues polling after a tick promise never resolves", async () => {
        config.deliveryPollMs = 2;
        config.deliveryBatchTimeoutMs = 10;
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(console, "log").mockImplementation(() => undefined);

        const engine = new ProbeEngine();
        engine.start();
        await new Promise((resolve) => setTimeout(resolve, 40));
        await engine.stop();

        // The old global `running` latch stayed true forever after tick 1.
        expect(engine.ticks).toBeGreaterThan(1);
    });
});
