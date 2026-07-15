import { afterEach, describe, expect, it, vi } from "vitest";

import { loadPersonalBindings } from "./personalBinding";

const GQL_URL = "http://vault.test:4000/graphql";
const ENAME = "@ada-0000-0000";

type StubResponse = {
    ok: boolean;
    status?: number;
    json: () => Promise<unknown>;
};

function docs(edges: unknown[]): StubResponse {
    return {
        ok: true,
        json: async () => ({ data: { bindingDocuments: { edges } } }),
    };
}

const PHOTO_EDGES = [{ node: { id: "photo-1", parsed: null } }];
// pickLatestEdge orders by signatures[0].timestamp and ignores anything without
// one, so these fixtures must carry a signature to be seen at all.
const PARAM_EDGES = [
    {
        node: {
            id: "param-1",
            parsed: {
                type: "personal_parameters",
                data: { text: "5'9\", brown eyes" },
                signatures: [{ timestamp: "2026-07-15T10:00:00.000Z" }],
            },
        },
    },
];
const SECURITY_EDGES = [
    {
        node: {
            id: "sec-1",
            parsed: {
                type: "security_question",
                data: { question: "First pet?" },
                signatures: [{ timestamp: "2026-07-15T10:00:00.000Z" }],
            },
        },
    },
];

/** Route each stubbed request by the `type` variable the caller sent. */
function stubVault(byType: (type: string) => StubResponse) {
    const mock = vi.fn(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as {
            variables?: { type?: string };
        };
        return byType(body.variables?.type ?? "");
    });
    vi.stubGlobal("fetch", mock);
    return mock;
}

const allGood = (type: string): StubResponse => {
    if (type === "photograph") return docs(PHOTO_EDGES);
    if (type === "personal_parameters") return docs(PARAM_EDGES);
    return docs(SECURITY_EDGES);
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("loadPersonalBindings — count-only path (home screen)", () => {
    it("returns every mark when all queries succeed", async () => {
        stubVault(allGood);

        const loaded = await loadPersonalBindings(GQL_URL, ENAME, {
            skipPhotoBlobs: true,
        });

        expect(loaded.photographs).toHaveLength(1);
        expect(loaded.parameters?.text).toBe("5'9\", brown eyes");
        expect(loaded.securityQuestion?.question).toBe("First pet?");
    });

    // The #1086 regression: these used to resolve with an empty result, which
    // the caller then wrote over the store as a full replace — wiping marks the
    // user still had. Rejecting is what lets the caller keep the last good state.
    it("rejects when a query fails at the HTTP level, instead of reporting no marks", async () => {
        stubVault((type) =>
            type === "photograph"
                ? { ok: false, status: 503, json: async () => ({}) }
                : allGood(type),
        );

        await expect(
            loadPersonalBindings(GQL_URL, ENAME, { skipPhotoBlobs: true }),
        ).rejects.toThrow(/503/);
    });

    it("rejects on a GraphQL-level error (HTTP 200 + errors)", async () => {
        stubVault((type) =>
            type === "security_question"
                ? {
                      ok: true,
                      json: async () => ({
                          errors: [{ message: "token expired" }],
                          data: null,
                      }),
                  }
                : allGood(type),
        );

        await expect(
            loadPersonalBindings(GQL_URL, ENAME, { skipPhotoBlobs: true }),
        ).rejects.toThrow(/token expired/);
    });

    it("still reports genuinely absent marks as empty, not as a failure", async () => {
        stubVault(() => docs([]));

        const loaded = await loadPersonalBindings(GQL_URL, ENAME, {
            skipPhotoBlobs: true,
        });

        expect(loaded.photographs).toHaveLength(0);
        expect(loaded.parameters).toBeNull();
        expect(loaded.securityQuestion).toBeNull();
    });
});
