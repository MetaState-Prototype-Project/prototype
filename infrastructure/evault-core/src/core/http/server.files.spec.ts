import fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DbService } from "../db/db.service";
import { FILE_SCHEMA_ID } from "../utils/w3ds-uri";
import { registerHttpRoutes } from "./server";

const LEGACY_FILE_RECORD_SCHEMA_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const OWNER_ENAME = "@owner";

describe("GET /files/:metaEnvelopeId", () => {
    let server: FastifyInstance;
    let findMetaEnvelopeById: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        findMetaEnvelopeById = vi.fn();
        server = fastify();
        await registerHttpRoutes(server, {}, undefined, {
            findMetaEnvelopeById,
        } as unknown as DbService);
        await server.ready();
    });

    afterEach(async () => {
        await server.close();
    });

    it("redirects a w3ds-file-v1 record to its publicUrl", async () => {
        findMetaEnvelopeById.mockResolvedValue({
            ontology: FILE_SCHEMA_ID,
            parsed: { publicUrl: "https://objects.example/current-video.mp4" },
        });

        const response = await server.inject({
            method: "GET",
            url: "/files/current-file",
            headers: { "x-ename": OWNER_ENAME },
        });

        expect(response.statusCode).toBe(302);
        expect(response.headers.location).toBe(
            "https://objects.example/current-video.mp4",
        );
    });

    it("redirects a legacy File record using its documented url and scopes the read to X-ENAME", async () => {
        findMetaEnvelopeById.mockResolvedValue({
            ontology: LEGACY_FILE_RECORD_SCHEMA_ID,
            parsed: { url: "https://objects.example/legacy-video.mp4" },
        });

        const response = await server.inject({
            method: "GET",
            url: "/files/legacy-file",
            headers: { "x-ename": OWNER_ENAME },
        });

        expect(response.statusCode).toBe(302);
        expect(response.headers.location).toBe(
            "https://objects.example/legacy-video.mp4",
        );
        expect(findMetaEnvelopeById).toHaveBeenCalledWith(
            "legacy-file",
            OWNER_ENAME,
        );
    });

    it("prefers publicUrl when a legacy File record contains both URL fields", async () => {
        findMetaEnvelopeById.mockResolvedValue({
            ontology: LEGACY_FILE_RECORD_SCHEMA_ID,
            parsed: {
                publicUrl: "https://objects.example/current-url.mp4",
                url: "https://objects.example/legacy-url.mp4",
            },
        });

        const response = await server.inject({
            method: "GET",
            url: "/files/legacy-file",
            headers: { "x-ename": OWNER_ENAME },
        });

        expect(response.statusCode).toBe(302);
        expect(response.headers.location).toBe(
            "https://objects.example/current-url.mp4",
        );
    });

    it("does not apply the legacy url fallback to unrelated ontologies", async () => {
        findMetaEnvelopeById.mockResolvedValue({
            ontology: "some-unrelated-ontology",
            parsed: { url: "https://objects.example/should-not-resolve.mp4" },
        });

        const response = await server.inject({
            method: "GET",
            url: "/files/unrelated-file",
            headers: { "x-ename": OWNER_ENAME },
        });

        expect(response.statusCode).toBe(404);
    });

    it("rejects an unsafe legacy File URL", async () => {
        findMetaEnvelopeById.mockResolvedValue({
            ontology: LEGACY_FILE_RECORD_SCHEMA_ID,
            parsed: { url: "javascript:alert(1)" },
        });

        const response = await server.inject({
            method: "GET",
            url: "/files/unsafe-file",
            headers: { "x-ename": OWNER_ENAME },
        });

        expect(response.statusCode).toBe(400);
    });

    it("requires X-ENAME before looking up a File record", async () => {
        const response = await server.inject({
            method: "GET",
            url: "/files/missing-owner",
        });

        expect(response.statusCode).toBe(400);
        expect(findMetaEnvelopeById).not.toHaveBeenCalled();
    });
});
