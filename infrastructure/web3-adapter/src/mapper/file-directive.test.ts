import { describe, expect, it, vi } from "vitest";
import type { EVaultClient } from "../evault/evault";
import type { MappingDatabase } from "../db";
import type { IMapping } from "./mapper.types";
import { fromGlobal, toGlobal } from "./mapper";

// Minimal stubs — the `__file()` directive paths never touch the mapping store.
const mappingStore = {} as MappingDatabase;

const PNG_DATA_URI =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==";

function mockClient(): EVaultClient {
	return {
		uploadFile: vi.fn(async (_w3id: string, input: { filename: string }) => ({
			uri: "w3ds://file?id=@owner/env-123",
			metaEnvelopeId: "env-123",
			publicUrl:
				"https://cdn.example.com/files/owner/env-123-" + input.filename,
		})),
		fetchMetaEnvelope: vi.fn(async (id: string) => ({
			id,
			schemaId: "w3ds-file-v1",
			w3id: "@owner",
			data: { publicUrl: `https://cdn.example.com/files/${id}.png` },
		})),
	} as unknown as EVaultClient;
}

const userMapping: IMapping = {
	tableName: "users",
	schemaId: "schema-user",
	ownerEnamePath: "ename",
	localToUniversalMap: {
		ename: "ename",
		avatarUrl: "__file(avatarUrl)",
	},
};

const postMapping: IMapping = {
	tableName: "posts",
	schemaId: "schema-post",
	ownerEnamePath: "ename",
	localToUniversalMap: {
		ename: "ename",
		images: "__file(images),mediaUrls",
	},
};

describe("__file mapping directive", () => {
	it("passes file fields through unchanged when no eVault client is supplied", async () => {
		const global = await toGlobal({
			data: { ename: "@owner", avatarUrl: PNG_DATA_URI },
			mapping: userMapping,
			mappingStore,
		});
		expect(global.data.avatarUrl).toBe(PNG_DATA_URI);

		const local = await fromGlobal({
			data: { ename: "@owner", avatarUrl: "w3ds://file?id=@owner/env-123" },
			mapping: userMapping,
			mappingStore,
		});
		expect(local.data.avatarUrl).toBe("w3ds://file?id=@owner/env-123");
	});

	it("uploads a data URI on toGlobal and replaces it with a w3ds URI", async () => {
		const client = mockClient();
		const global = await toGlobal({
			data: { ename: "@owner", avatarUrl: PNG_DATA_URI },
			mapping: userMapping,
			mappingStore,
			evaultClient: client,
		});
		expect(global.data.avatarUrl).toBe("w3ds://file?id=@owner/env-123");
		expect(client.uploadFile).toHaveBeenCalledOnce();
	});

	it("leaves a plain URL untouched on toGlobal", async () => {
		const client = mockClient();
		const global = await toGlobal({
			data: { ename: "@owner", avatarUrl: "https://example.com/a.png" },
			mapping: userMapping,
			mappingStore,
			evaultClient: client,
		});
		expect(global.data.avatarUrl).toBe("https://example.com/a.png");
		expect(client.uploadFile).not.toHaveBeenCalled();
	});

	it("dereferences a w3ds URI to its public URL on fromGlobal", async () => {
		const client = mockClient();
		const local = await fromGlobal({
			data: { ename: "@owner", avatarUrl: "w3ds://file?id=@owner/env-abc" },
			mapping: userMapping,
			mappingStore,
			evaultClient: client,
		});
		expect(local.data.avatarUrl).toBe(
			"https://cdn.example.com/files/env-abc.png",
		);
	});

	it("leaves a non-w3ds value untouched on fromGlobal", async () => {
		const client = mockClient();
		const local = await fromGlobal({
			data: { ename: "@owner", avatarUrl: "https://example.com/a.png" },
			mapping: userMapping,
			mappingStore,
			evaultClient: client,
		});
		expect(local.data.avatarUrl).toBe("https://example.com/a.png");
		expect(client.fetchMetaEnvelope).not.toHaveBeenCalled();
	});

	it("handles arrays of files in both directions", async () => {
		const client = mockClient();
		const global = await toGlobal({
			data: {
				ename: "@owner",
				images: [PNG_DATA_URI, "https://example.com/keep.png"],
			},
			mapping: postMapping,
			mappingStore,
			evaultClient: client,
		});
		expect(global.data.mediaUrls).toEqual([
			"w3ds://file?id=@owner/env-123",
			"https://example.com/keep.png",
		]);

		const local = await fromGlobal({
			data: {
				ename: "@owner",
				mediaUrls: [
					"w3ds://file?id=@owner/env-1",
					"https://example.com/keep.png",
				],
			},
			mapping: postMapping,
			mappingStore,
			evaultClient: client,
		});
		expect(local.data.images).toEqual([
			"https://cdn.example.com/files/env-1.png",
			"https://example.com/keep.png",
		]);
	});
});
