import { describe, expect, it, vi } from "vitest";
import { CODE_COMMIT_ONTOLOGY_ID, EVaultClient } from "./client.js";

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

const samplePayload = {
    id: "abc123",
    repo: "alice/repo",
    ref: "refs/heads/main",
    message: "a commit",
    authorEName: "@alice",
    committedAt: "2026-08-14T10:00:00Z",
    added: ["a.ts"],
    removed: [],
    modified: [],
    diffUrl: "https://s3.example.org/diffs/alice/repo/abc123.diff",
};

describe("EVaultClient.writeCommit", () => {
    it("certifies once, then writes a MetaEnvelope with the right ontology and acl", async () => {
        const calls: Array<{ url: string; body: unknown }> = [];
        const fetchImpl = vi.fn(async (url: unknown, init?: RequestInit) => {
            const urlStr = String(url);
            const body = init?.body ? JSON.parse(String(init.body)) : null;
            calls.push({ url: urlStr, body });

            if (urlStr.endsWith("/platforms/certification")) {
                return jsonResponse(200, {
                    token: "platform-token",
                    expiresAt: Date.now() + 3_600_000,
                });
            }
            if (urlStr.endsWith("/graphql")) {
                return jsonResponse(200, {
                    data: {
                        createMetaEnvelope: {
                            metaEnvelope: { id: "envelope-1" },
                            errors: [],
                        },
                    },
                });
            }
            throw new Error(`unexpected fetch: ${urlStr}`);
        });

        const client = new EVaultClient({
            registryUrl: "https://registry.example.org",
            evaultServerUri: "https://evault.example.org",
            publicUrl: "https://forgejo-sync.example.org",
            fetchImpl: fetchImpl as unknown as typeof fetch,
        });

        const id = await client.writeCommit("@alice", samplePayload, ["*"]);

        expect(id).toBe("envelope-1");
        expect(calls[0]?.url).toBe(
            "https://registry.example.org/platforms/certification",
        );
        expect(calls[0]?.body).toEqual({
            platform: "https://forgejo-sync.example.org",
        });

        const graphqlCall = calls[1];
        expect(graphqlCall?.body).toMatchObject({
            variables: {
                input: {
                    ontology: CODE_COMMIT_ONTOLOGY_ID,
                    payload: samplePayload,
                    acl: ["*"],
                },
            },
        });
    });

    it("reuses the platform token across multiple writes within its expiry", async () => {
        let certifications = 0;
        const fetchImpl = vi.fn(async (url: unknown) => {
            const urlStr = String(url);
            if (urlStr.endsWith("/platforms/certification")) {
                certifications += 1;
                return jsonResponse(200, {
                    token: "platform-token",
                    expiresAt: Date.now() + 3_600_000,
                });
            }
            return jsonResponse(200, {
                data: {
                    createMetaEnvelope: {
                        metaEnvelope: { id: "envelope-x" },
                        errors: [],
                    },
                },
            });
        });

        const client = new EVaultClient({
            registryUrl: "https://registry.example.org",
            evaultServerUri: "https://evault.example.org",
            publicUrl: "https://forgejo-sync.example.org",
            fetchImpl: fetchImpl as unknown as typeof fetch,
        });

        await client.writeCommit("@alice", samplePayload, ["*"]);
        await client.writeCommit("@bob", samplePayload, ["@bob"]);

        expect(certifications).toBe(1);
    });

    it("throws when createMetaEnvelope returns errors", async () => {
        const fetchImpl = vi.fn(async (url: unknown) => {
            const urlStr = String(url);
            if (urlStr.endsWith("/platforms/certification")) {
                return jsonResponse(200, {
                    token: "platform-token",
                    expiresAt: Date.now() + 3_600_000,
                });
            }
            return jsonResponse(200, {
                data: {
                    createMetaEnvelope: {
                        metaEnvelope: null,
                        errors: [{ message: "ontology not found" }],
                    },
                },
            });
        });

        const client = new EVaultClient({
            registryUrl: "https://registry.example.org",
            evaultServerUri: "https://evault.example.org",
            publicUrl: "https://forgejo-sync.example.org",
            fetchImpl: fetchImpl as unknown as typeof fetch,
        });

        await expect(
            client.writeCommit("@alice", samplePayload, ["*"]),
        ).rejects.toThrow(/ontology not found/);
    });

    it("throws when certification itself fails", async () => {
        const fetchImpl = vi.fn(async () => jsonResponse(500, {}));

        const client = new EVaultClient({
            registryUrl: "https://registry.example.org",
            evaultServerUri: "https://evault.example.org",
            publicUrl: "https://forgejo-sync.example.org",
            fetchImpl: fetchImpl as unknown as typeof fetch,
        });

        await expect(
            client.writeCommit("@alice", samplePayload, ["*"]),
        ).rejects.toThrow(/Failed to get platform token/);
    });
});
