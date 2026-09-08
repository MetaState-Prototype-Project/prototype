import { Timestamp } from "firebase-admin/firestore";
import { normaliseEName, normaliseENameList } from "web3-adapter";

/**
 * Turns an inbound chat or message envelope into the shape Firestore stores.
 *
 * Kept apart from the webhook controller so the reference handling can be
 * tested without a Firestore connection — this is the code path that used to
 * throw a TypeError on a bare eName and lose an entire room, so it is worth
 * being able to exercise directly.
 */

export type MappedChat = {
	type: "direct" | "group";
	name?: string;
	participants: string[];
	admins: string[];
	ename?: string | null;
	createdAt: Timestamp;
	updatedAt: Timestamp;
	lastMessage?: {
		text: string;
		senderId: string;
		timestamp: Timestamp;
	} | null;
};

export type MappedMessage = {
	chatId: string | null;
	senderId: string | null;
	text: string;
	createdAt: Timestamp;
	updatedAt: Timestamp;
	readBy: string[];
	isSystemMessage: boolean;
};

/**
 * Reads the id out of a `table(id)` reference.
 *
 * A chat reference is a local relation resolved through the mapping store, so
 * it keeps this form; entity references (people) are eNames and do not.
 * Returns `null` for anything unparseable, so one malformed reference drops one
 * record instead of throwing partway through an ingest.
 */
export function parseLocalRef(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const id = value.split("(")[1]?.split(")")[0];
	return id && id.length > 0 ? id : null;
}

/**
 * Maps an inbound chat envelope.
 *
 * Participants arrive as eNames, and a Blabsy user document is keyed by the
 * user's eName, so a participant reference is already the local document id and
 * needs no lookup. Entries that are not usable eNames are dropped and counted
 * rather than being allowed to throw: a chat may name members who live on a
 * platform this instance knows nothing about, and one such member must not cost
 * the room its other members.
 */
export function mapChatData(
	// biome-ignore lint/suspicious/noExplicitAny: inbound envelope payload
	data: any,
	now: Timestamp,
): MappedChat {
	const participants = normaliseENameList(data.participants);
	const admins = normaliseENameList(data.admins);

	const supplied = Array.isArray(data.participants)
		? data.participants.length
		: 0;
	if (supplied > participants.length) {
		console.warn(
			`Skipped ${supplied - participants.length} unusable participant reference(s) on chat ${data.ename ?? "?"}`,
		);
	}

	return {
		type: participants.length > 2 ? "group" : "direct",
		name: data.name,
		participants,
		admins,
		ename: data.ename || null,
		createdAt: data.createdAt
			? Timestamp.fromDate(new Date(data.createdAt))
			: now,
		updatedAt: now,
		lastMessage: data.lastMessage
			? {
					...data.lastMessage,
					timestamp: Timestamp.fromDate(new Date(data.lastMessage.timestamp)),
				}
			: null,
	};
}

/**
 * Maps an inbound message envelope.
 *
 * A message whose sender cannot be resolved becomes a system message rather
 * than being dropped: the text is still worth showing, and an unattributed line
 * reads better than a hole in the conversation.
 */
export function mapMessageData(
	// biome-ignore lint/suspicious/noExplicitAny: inbound envelope payload
	data: any,
	now: Timestamp,
): MappedMessage {
	const chatId = parseLocalRef(data.chatId);
	const senderId = normaliseEName(data.senderId);

	const isSystemMessage =
		!senderId || Boolean(data.text?.startsWith("$$system-message$$"));

	if (data.senderId && !senderId) {
		console.warn(
			"Message sender is not a usable eName, treating as system message:",
			data.senderId,
		);
	}

	return {
		chatId,
		senderId: isSystemMessage ? null : senderId,
		text: data.text,
		createdAt: data.createdAt
			? Timestamp.fromDate(new Date(data.createdAt))
			: now,
		updatedAt: now,
		readBy: data.readBy || [],
		isSystemMessage,
	};
}
