import { Repository } from "typeorm";
import { Notification } from "../entities/Notification";
import { Verification } from "../entities/Verification";
import { NotificationService } from "./NotificationService";
import type { DbService } from "../core/db/db.service";
import { deserializeValue } from "../core/db/schema";

const MESSAGE_SCHEMA_ID = "550e8400-e29b-41d4-a716-446655440004";
const GROUP_SCHEMA_ID = "550e8400-e29b-41d4-a716-446655440003";

export interface MessageNotificationParams {
    messageGlobalId: string;
    payload: Record<string, any>;
    senderEName: string;
    acl: string[];
}

export class MessageNotificationService {
    private notificationService: NotificationService;
    private db: DbService;

    constructor(
        verificationRepository: Repository<Verification>,
        notificationRepository: Repository<Notification>,
        db: DbService
    ) {
        this.notificationService = new NotificationService(
            verificationRepository,
            notificationRepository
        );
        this.db = db;
    }

    static isMessageSchema(ontology: string): boolean {
        return ontology === MESSAGE_SCHEMA_ID;
    }

    async notifyParticipants(params: MessageNotificationParams): Promise<void> {
        const { messageGlobalId, payload, senderEName } = params;

        console.log(`[NOTIF] Processing message notification for message ${messageGlobalId} from ${senderEName}`);
        console.log(`[NOTIF] Message payload keys: ${Object.keys(payload).join(", ")}`);

        const globalChatId = payload.chatId || "";
        if (!globalChatId) {
            console.log("[NOTIF] SKIPPED: no chatId in payload");
            return;
        }

        console.log(`[NOTIF] Looking up chat data for globalChatId: ${globalChatId}`);

        // Look up the chat MetaEnvelope to find participants, admins, and owner
        const chatData = await this.getChatData(globalChatId);
        if (!chatData) {
            console.log(`[NOTIF] SKIPPED: chat ${globalChatId} not found in Neo4j`);
            return;
        }

        console.log(`[NOTIF] Chat data found. Keys: ${Object.keys(chatData).join(", ")}`);
        console.log(`[NOTIF] participantIds: ${JSON.stringify(chatData.participantIds)}`);
        console.log(`[NOTIF] admins: ${JSON.stringify(chatData.admins)}`);
        console.log(`[NOTIF] owner: ${JSON.stringify(chatData.owner)}`);
        console.log(`[NOTIF] name: ${JSON.stringify(chatData.name)}`);

        // Merge all participant MetaEnvelope IDs: participantIds + admins + owner
        const allParticipantMetaIds = new Set<string>();

        if (Array.isArray(chatData.participantIds)) {
            for (const p of chatData.participantIds) {
                if (p) allParticipantMetaIds.add(String(p));
            }
        }
        if (Array.isArray(chatData.admins)) {
            for (const a of chatData.admins) {
                if (a) allParticipantMetaIds.add(String(a));
            }
        }
        if (chatData.owner) {
            allParticipantMetaIds.add(String(chatData.owner));
        }

        console.log(`[NOTIF] Participant MetaEnvelope IDs: ${[...allParticipantMetaIds].join(", ")}`);

        // Resolve MetaEnvelope IDs to eNames
        const eNameMap = await this.resolveMetaEnvelopeIdsToENames([...allParticipantMetaIds]);
        console.log(`[NOTIF] Resolved eNames: ${JSON.stringify(Object.fromEntries(eNameMap))}`);

        const allENames = new Set<string>();
        for (const [metaId, eName] of eNameMap) {
            if (eName) allENames.add(eName);
        }

        // Remove the sender
        allENames.delete(senderEName);

        const recipients = [...allENames];

        if (recipients.length === 0) {
            console.log(`[NOTIF] SKIPPED: no recipients after removing sender ${senderEName}`);
            return;
        }

        console.log(`[NOTIF] Recipients (eNames): ${recipients.join(", ")}`);

        const messageText = payload.content || payload.text || "";
        const truncatedText =
            messageText.length > 100
                ? messageText.substring(0, 100) + "..."
                : messageText;

        const senderDisplay = senderEName.startsWith("@")
            ? senderEName
            : `@${senderEName}`;

        // Determine DM vs group based on total participant count
        const isDM = allENames.size <= 1; // only 1 left after removing sender = 2 people total

        let title: string;
        let body: string;

        if (isDM) {
            title = `New message from ${senderDisplay}`;
            body = truncatedText || "Sent a message";
        } else {
            const groupName = chatData.name || "a group";
            title = `New message in ${groupName}`;
            body = `${senderDisplay}: ${truncatedText || "Sent a message"}`;
        }

        console.log(`[NOTIF] isDM: ${isDM}, title: "${title}", body: "${body}"`);

        const notificationPayload = {
            title,
            body,
            data: {
                type: "new_message",
                globalMessageId: messageGlobalId,
                globalChatId,
            },
        };

        console.log(`[NOTIF] Sending notifications to ${recipients.length} recipient(s)...`);

        const results = await Promise.allSettled(
            recipients.map((eName) =>
                this.notificationService.sendNotificationToEName(
                    eName,
                    notificationPayload
                )
            )
        );

        const succeeded = results.filter(
            (r) => r.status === "fulfilled" && r.value
        ).length;
        const failed = results.length - succeeded;

        console.log(`[NOTIF] Results: ${succeeded} sent, ${failed} failed (message: ${messageGlobalId})`);

        // Log individual failures
        results.forEach((r, i) => {
            if (r.status === "rejected") {
                console.error(`[NOTIF] Failed to notify ${recipients[i]}:`, r.reason);
            } else if (!r.value) {
                console.log(`[NOTIF] No devices found for ${recipients[i]}`);
            }
        });
    }

    /**
     * Resolves MetaEnvelope IDs to their owner eNames by querying Neo4j.
     * The participant/admin/owner fields in chat data store MetaEnvelope IDs
     * for user profiles, not eNames directly.
     */
    private async resolveMetaEnvelopeIdsToENames(
        metaIds: string[]
    ): Promise<Map<string, string | null>> {
        const result = new Map<string, string | null>();
        if (metaIds.length === 0) return result;

        try {
            const queryResult = await this.db.runQuery(
                `
                MATCH (m:MetaEnvelope)
                WHERE m.id IN $ids
                RETURN m.id AS id, m.eName AS eName
                `,
                { ids: metaIds }
            );

            for (const record of queryResult.records) {
                const id = record.get("id");
                const eName = record.get("eName");
                result.set(id, eName || null);
                console.log(`[NOTIF] Resolved MetaEnvelope ${id} → eName: ${eName}`);
            }

            // Mark any unresolved IDs
            for (const id of metaIds) {
                if (!result.has(id)) {
                    console.log(`[NOTIF] Could not resolve MetaEnvelope ${id} to eName`);
                    result.set(id, null);
                }
            }
        } catch (error) {
            console.error("[NOTIF] Failed to resolve MetaEnvelope IDs to eNames:", error);
            for (const id of metaIds) {
                result.set(id, null);
            }
        }

        return result;
    }

    private async getChatData(
        globalChatId: string
    ): Promise<Record<string, any> | null> {
        try {
            console.log(`[NOTIF] Querying Neo4j for chat MetaEnvelope: id=${globalChatId}, ontology=${GROUP_SCHEMA_ID}`);

            const result = await this.db.runQuery(
                `
                MATCH (m:MetaEnvelope { id: $id, ontology: $ontology })-[:LINKS_TO]->(e:Envelope)
                RETURN m.id AS id, collect(e) AS envelopes
                LIMIT 1
                `,
                { id: globalChatId, ontology: GROUP_SCHEMA_ID }
            );

            if (!result.records[0]) {
                console.log(`[NOTIF] No MetaEnvelope found for chat ${globalChatId}`);
                return null;
            }

            const record = result.records[0];
            const envelopes = record.get("envelopes");
            console.log(`[NOTIF] Found ${envelopes.length} envelope(s) for chat ${globalChatId}`);

            // Parse envelopes into a flat object
            const parsed: Record<string, any> = {};
            for (const node of envelopes) {
                const props = node.properties;
                const key = props.ontology;
                const value = deserializeValue(props.value, props.valueType);
                parsed[key] = value;
                console.log(`[NOTIF] Envelope field "${key}": ${JSON.stringify(value)}`);
            }

            return parsed;
        } catch (error) {
            console.error("[NOTIF] Failed to fetch chat data for notification:", error);
            return null;
        }
    }
}
