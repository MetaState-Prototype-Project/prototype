import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RepoEnvelopeStore } from "./repoEnvelopeStore.js";

let dir: string;
let store: RepoEnvelopeStore;

beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "forgejo-code-sync-repo-store-"));
    store = new RepoEnvelopeStore({ dir });
    await store.init();
});

afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
});

describe("RepoEnvelopeStore", () => {
    it("returns null for a repo with no recorded envelope", async () => {
        expect(await store.get("alice/repo")).toBeNull();
    });

    it("returns the recorded envelope id after set", async () => {
        await store.set("alice/repo", "envelope-1");
        expect(await store.get("alice/repo")).toBe("envelope-1");
    });

    it("overwrites the recorded envelope id on a second set for the same repo", async () => {
        await store.set("alice/repo", "envelope-1");
        await store.set("alice/repo", "envelope-2");
        expect(await store.get("alice/repo")).toBe("envelope-2");
    });

    it("keeps different repos' envelope ids independent", async () => {
        await store.set("alice/repo", "envelope-1");
        await store.set("bob/other-repo", "envelope-2");

        expect(await store.get("alice/repo")).toBe("envelope-1");
        expect(await store.get("bob/other-repo")).toBe("envelope-2");
    });

    it("survives a simulated restart - reload from the backing store, not memory", async () => {
        await store.set("alice/repo", "envelope-1");

        const reloaded = new RepoEnvelopeStore({ dir });
        await reloaded.init();

        expect(await reloaded.get("alice/repo")).toBe("envelope-1");
    });
});
