import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { mapChatData, mapMessageData, parseLocalRef } from "./chat-mapping";

const ALICE = "@48468c9a-dc1b-5663-92fb-5e46e3d2a7f0";
const BOB = "@7f3d2e1a-9b8c-4d5e-8f0a-1b2c3d4e5f60";
const CAROL = "@0c0ffee0-dead-4bee-8fee-000000000000";

const now = Timestamp.fromDate(new Date("2026-01-01T00:00:00Z"));

describe("blabsy chat envelope mapping", () => {
	describe("mapChatData", () => {
		it("keeps eName participants as-is, since user docs are keyed by eName", async () => {
			const chat = mapChatData(
				{ ename: "@group", participants: [ALICE, BOB], admins: [ALICE] },
				now,
			);

			expect(chat.participants).toEqual([ALICE, BOB]);
			expect(chat.admins).toEqual([ALICE]);
		});

		it("ingests a chat whose participants are all eNames", () => {
			const chat = mapChatData(
				{ ename: "@group", name: "Standup", participants: [ALICE, BOB] },
				now,
			);

			expect(chat.type).toBe("direct");
			expect(chat.name).toBe("Standup");
			expect(chat.ename).toBe("@group");
		});

		it("does not throw on malformed entries, and still ingests the room", () => {
			// Every one of these crashed the old unguarded
			// `p.split("(")[1].split(")")[0]`.
			const chat = mapChatData(
				{
					ename: "@group",
					participants: [ALICE, null, 42, "", { nested: true }, [], BOB],
					admins: null,
				},
				now,
			);

			expect(chat.participants).toEqual([ALICE, BOB]);
			expect(chat.admins).toEqual([]);
		});

		it("survives participants being absent entirely", () => {
			expect(() => mapChatData({ ename: "@group" }, now)).not.toThrow();
			expect(mapChatData({ ename: "@group" }, now).participants).toEqual([]);
		});

		it("drops legacy envelope-id references rather than accepting them", () => {
			const chat = mapChatData(
				{
					ename: "@group",
					participants: ["user(3f8c1e2d-0000-4444-8888-aaaabbbbcccc)", ALICE],
				},
				now,
			);

			expect(chat.participants).toEqual([ALICE]);
		});

		it("derives group type from the surviving participant count", () => {
			expect(
				mapChatData({ participants: [ALICE, BOB, CAROL] }, now).type,
			).toBe("group");
			expect(mapChatData({ participants: [ALICE, BOB] }, now).type).toBe(
				"direct",
			);
		});
	});

	describe("mapMessageData", () => {
		it("attributes a message to the eName that sent it", () => {
			const message = mapMessageData(
				{ chatId: "chat(local-chat-1)", senderId: BOB, text: "hi" },
				now,
			);

			expect(message.senderId).toBe(BOB);
			expect(message.chatId).toBe("local-chat-1");
			expect(message.isSystemMessage).toBe(false);
		});

		it("treats an unusable sender as a system message instead of throwing", () => {
			for (const senderId of [null, undefined, "", 42, "user(abc)"]) {
				const message = mapMessageData(
					{ chatId: "chat(local-chat-1)", senderId, text: "hi" },
					now,
				);
				expect(message.senderId).toBeNull();
				expect(message.isSystemMessage).toBe(true);
				// The text survives; only the attribution is lost.
				expect(message.text).toBe("hi");
			}
		});

		it("reports an unusable chat reference as null rather than throwing", () => {
			for (const chatId of [null, undefined, "", 42, "not-a-ref"]) {
				expect(() =>
					mapMessageData({ chatId, senderId: BOB, text: "hi" }, now),
				).not.toThrow();
				expect(
					mapMessageData({ chatId, senderId: BOB, text: "hi" }, now).chatId,
				).toBeNull();
			}
		});

		it("keeps explicit system messages unattributed", () => {
			const message = mapMessageData(
				{
					chatId: "chat(local-chat-1)",
					senderId: BOB,
					text: "$$system-message$$ joined",
				},
				now,
			);

			expect(message.isSystemMessage).toBe(true);
			expect(message.senderId).toBeNull();
		});
	});

	describe("parseLocalRef", () => {
		it("reads the id out of a table(id) reference", () => {
			expect(parseLocalRef("chat(abc-123)")).toBe("abc-123");
		});

		it("returns null for anything else", () => {
			for (const value of [null, undefined, "", 42, {}, [], "plain", ALICE]) {
				expect(parseLocalRef(value)).toBeNull();
			}
		});
	});
});
