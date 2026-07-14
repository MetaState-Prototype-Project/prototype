import { afterEach, describe, expect, it, vi } from "vitest";

// evault.ts imports these at runtime; mock them so the module loads in a plain
// Node test env without pulling Tauri / wallet-sdk internals.
vi.mock("wallet-sdk", () => ({ syncPublicKeyToEvault: vi.fn() }));
vi.mock("../../services/NotificationService", () => ({
    default: {
        getInstance: () => ({ registerDevice: vi.fn(async () => true) }),
    },
}));

import { VaultController } from "./evault";

const VAULT = { ename: "user@w3id.example", uri: "https://evault.example" };

/** Build a VaultController whose only exercised dependency is `store.get`. */
function makeController(get: (key: string) => Promise<unknown>) {
    const store = { get } as unknown as ConstructorParameters<
        typeof VaultController
    >[0];
    const userController = {
        user: Promise.resolve(undefined),
    } as unknown as ConstructorParameters<typeof VaultController>[1];
    return new VaultController(store, userController);
}

afterEach(() => {
    vi.useRealTimers();
});

describe("VaultController.vault — #readVaultResilient retry behavior", () => {
    it("returns immediately for a resolved undefined (genuine logout), no retry", async () => {
        const get = vi.fn(async () => undefined);
        const vc = makeController(get);

        await expect(vc.vault).resolves.toBeUndefined();
        expect(get).toHaveBeenCalledTimes(1); // no retry when the key is simply absent
    });

    it("retries thrown store errors up to maxAttempts, then returns undefined without throwing", async () => {
        vi.useFakeTimers();
        const get = vi.fn(async () => {
            throw new Error(
                "Fetch API cannot load ipc://localhost/plugin:store|get",
            );
        });
        const vc = makeController(get);

        const result = vc.vault;
        await vi.runAllTimersAsync(); // skip the 200ms backoffs

        await expect(result).resolves.toBeUndefined();
        expect(get).toHaveBeenCalledTimes(10); // maxAttempts
    });

    it("recovers the vault when the store IPC comes back mid-retry", async () => {
        vi.useFakeTimers();
        let calls = 0;
        const get = vi.fn(async () => {
            if (calls++ < 6) throw new Error("IPC custom protocol failed");
            return VAULT;
        });
        const vc = makeController(get);

        const result = vc.vault;
        await vi.runAllTimersAsync();

        await expect(result).resolves.toEqual(VAULT);
        expect(get).toHaveBeenCalledTimes(7);
    });

    it("coalesces concurrent reads into a single in-flight store read", async () => {
        const get = vi.fn(async () => VAULT);
        const vc = makeController(get);

        const [a, b] = await Promise.all([vc.vault, vc.vault]);

        expect(a).toEqual(VAULT);
        expect(b).toEqual(VAULT);
        expect(get).toHaveBeenCalledTimes(1); // both callers shared one read

        // ...and a later, independent access performs a fresh read.
        await vc.vault;
        expect(get).toHaveBeenCalledTimes(2);
    });
});
