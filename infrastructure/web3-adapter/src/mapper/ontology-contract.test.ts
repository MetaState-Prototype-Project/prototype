import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { IMapping } from "./mapper.types";

/**
 * Keeps the published ontology honest about what platforms actually emit.
 *
 * The identifier drift this change fixes was possible because nothing written
 * down said what a chat entity reference contained — the convention lived only
 * in two implementations agreeing. A schema that quietly disagrees with the
 * mappings is how that happens again, so the disagreement is a test failure.
 */

const REPO = join(__dirname, "../../../..");

const CHAT_SCHEMA = "550e8400-e29b-41d4-a716-446655440003";
const MESSAGE_SCHEMA = "550e8400-e29b-41d4-a716-446655440004";

const ENAME_PATTERN = "^@.+";

/** Global field names that name people, and so must be declared as eNames. */
const ENTITY_TARGETS = new Set([
	"participantIds",
	"admins",
	"adminIds",
	"memberIds",
	"owner",
	"senderId",
	"readBy",
]);

function schema(name: string): {
	properties: Record<
		string,
		{ type?: string; pattern?: string; items?: { pattern?: string } }
	>;
	required?: string[];
	additionalProperties?: boolean;
} {
	return JSON.parse(
		readFileSync(join(REPO, "services/ontology/schemas", name), "utf8"),
	);
}

/** Every global field name any shipped mapping emits for a given schema. */
function emittedTargets(schemaId: string): Map<string, string[]> {
	const out = new Map<string, string[]>();

	for (const file of [
		"chat.mapping.json",
		"group.mapping.json",
		"message.mapping.json",
	]) {
		for (const dir of [
			"platforms/pictique/api",
			"platforms/blabsy/api",
			"platforms/ereputation/api",
			"platforms/esigner/api",
			"platforms/file-manager/api",
			"platforms/ecurrency/api",
			"platforms/dreamsync/api",
			"platforms/evoting/api",
			"platforms/group-charter-manager/api",
			"platforms/cerberus/client",
		]) {
			let mapping: IMapping;
			try {
				mapping = JSON.parse(
					readFileSync(
						join(REPO, dir, "src/web3adapter/mappings", file),
						"utf8",
					),
				);
			} catch {
				continue;
			}
			if (mapping.schemaId !== schemaId) continue;

			for (const spec of Object.values(mapping.localToUniversalMap)) {
				// `path,alias` targets the alias; a `__fn(x)` with no alias
				// targets whatever the directive names.
				const target = spec.includes(",")
					? spec.split(",")[1]
					: spec.replace(/^__\w+\((.+)\)$/, "$1");

				const platform = dir.split("/")[1];
				out.set(target, [...(out.get(target) ?? []), platform]);
			}
		}
	}
	return out;
}

describe("ontology matches the shipped mappings", () => {
	describe("Chat/Group schema", () => {
		const chat = schema("chat.json");
		const emitted = emittedTargets(CHAT_SCHEMA);

		it("declares every field the platforms emit", () => {
			// `additionalProperties: false` makes an undeclared field a
			// contradiction rather than an omission.
			expect(chat.additionalProperties).toBe(false);

			const undeclared = [...emitted.entries()]
				.filter(([field]) => !(field in chat.properties))
				.map(([field, platforms]) => `${field} (${platforms.join(", ")})`);

			expect(undeclared).toEqual([]);
		});

		it("declares entity references as eNames, not uuids", () => {
			for (const field of Object.keys(chat.properties)) {
				if (!ENTITY_TARGETS.has(field)) continue;
				const prop = chat.properties[field];

				const pattern =
					prop.type === "array" ? prop.items?.pattern : prop.pattern;
				expect(pattern, `${field} should require an @-prefixed eName`).toBe(
					ENAME_PATTERN,
				);
			}
		});
	});

	describe("Message schema", () => {
		const message = schema("message.json");
		const emitted = emittedTargets(MESSAGE_SCHEMA);

		it("declares every field the platforms emit", () => {
			const undeclared = [...emitted.entries()]
				.filter(([field]) => !(field in message.properties))
				.map(([field, platforms]) => `${field} (${platforms.join(", ")})`);

			expect(undeclared).toEqual([]);
		});

		it("declares senderId as an eName", () => {
			expect(message.properties.senderId?.pattern).toBe(ENAME_PATTERN);
		});

		it("does not require senderId, since a system message has no sender", () => {
			expect(message.required ?? []).not.toContain("senderId");
		});

		it("leaves chatId a record reference rather than an eName", () => {
			// chatId resolves through the producing platform's id mapping. Giving
			// it an eName pattern would be wrong in the opposite direction.
			expect(message.properties.chatId?.pattern).toBeUndefined();
		});
	});
});
