import { Repository } from "typeorm";
import { Notification } from "../entities/Notification";
import { Verification } from "../entities/Verification";
import { DeviceToken } from "../entities/DeviceToken";
import { NotificationService } from "./NotificationService";
import type { DbService } from "../core/db/db.service";
import { deserializeValue } from "../core/db/schema";

const MESSAGE_SCHEMA_ID = "550e8400-e29b-41d4-a716-446655440004";
const GROUP_SCHEMA_ID = "550e8400-e29b-41d4-a716-446655440003";
const USER_SCHEMA_ID = "550e8400-e29b-41d4-a716-446655440000";

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
        db: DbService,
        deviceTokenRepository?: Repository<DeviceToken>,
    ) {
        this.notificationService = new NotificationService(
            verificationRepository,
            notificationRepository,
            deviceTokenRepository,
        );
        this.db = db;
    }

    static isMessageSchema(ontology: string): boolean {
        return ontology === MESSAGE_SCHEMA_ID;
    }

    async notifyParticipants(params: MessageNotificationParams): Promise<void> {
        const { messageGlobalId, payload, senderEName } = params;

        const globalChatId = payload.chatId || "";
        if (!globalChatId) return;

        const chatData = await this.getChatData(globalChatId);
        if (!chatData) return;

        // Merge all participant MetaEnvelope IDs
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

        // Resolve MetaEnvelope IDs to eNames
        const eNameMap = await this.resolveMetaEnvelopeIdsToENames([...allParticipantMetaIds]);

        const allENames = new Set<string>();
        for (const [, eName] of eNameMap) {
            if (eName) allENames.add(eName);
        }

        // Remove the sender
        allENames.delete(senderEName);
        const recipients = [...allENames];
        if (recipients.length === 0) return;

        const messageText = payload.content || payload.text || "";
        const truncatedText =
            messageText.length > 100
                ? messageText.substring(0, 100) + "..."
                : messageText;

        // Resolve sender's display name
        const senderDisplayName = await this.getUserDisplayName(senderEName);
        const senderDisplay = senderDisplayName || senderEName;

        // Determine DM vs group
        const isDM = allENames.size <= 1;

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

        const notificationPayload = {
            title,
            body,
            data: {
                type: "new_message",
                globalMessageId: messageGlobalId,
                globalChatId,
            },
        };

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
        console.log(`[NOTIF] ${succeeded} sent, ${failed} failed for message ${messageGlobalId}`);
    }

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
                result.set(record.get("id"), record.get("eName") || null);
            }

            for (const id of metaIds) {
                if (!result.has(id)) result.set(id, null);
            }
        } catch (error) {
            console.error("[NOTIF] Failed to resolve MetaEnvelope IDs to eNames:", error);
            for (const id of metaIds) {
                result.set(id, null);
            }
        }

        return result;
    }

    /**
     * Looks up the sender's displayName from their User profile MetaEnvelope.
     * Each field is stored as a separate Envelope node with ontology = field name.
     */
    private async getUserDisplayName(eName: string): Promise<string | null> {
        try {
            // Try both with and without @ prefix
            const eNameVariants = [eName];
            if (eName.startsWith("@")) {
                eNameVariants.push(eName.slice(1));
            } else {
                eNameVariants.push(`@${eName}`);
            }

            // First: find ALL envelopes linked to the User MetaEnvelope for this eName
            const result = await this.db.runQuery(
                `
                MATCH (m:MetaEnvelope { ontology: $ontology })-[:LINKS_TO]->(e:Envelope)
                WHERE m.eName IN $eNames
                RETURN e.ontology AS field, e.value AS value, e.valueType AS valueType
                `,
                { eNames: eNameVariants, ontology: USER_SCHEMA_ID }
            );

            if (result.records.length === 0) {
                console.log(`[NOTIF] No User MetaEnvelope found for ${eName}`);
                return null;
            }

            // Log all fields and find displayName
            for (const rec of result.records) {
                const field = rec.get("field");
                const raw = rec.get("value");
                const vt = rec.get("valueType");
                console.log(`[NOTIF] User envelope field "${field}" (type: ${vt})`);
                if (field === "displayName") {
                    return deserializeValue(raw, vt) || null;
                }
            }

            return null;
        } catch (error) {
            console.error(`[NOTIF] Failed to look up displayName for ${eName}:`, error);
            return null;
        }
    }

    private async getChatData(
        globalChatId: string
    ): Promise<Record<string, any> | null> {
        try {
            const result = await this.db.runQuery(
                `
                MATCH (m:MetaEnvelope { id: $id, ontology: $ontology })-[:LINKS_TO]->(e:Envelope)
                RETURN m.id AS id, collect(e) AS envelopes
                LIMIT 1
                `,
                { id: globalChatId, ontology: GROUP_SCHEMA_ID }
            );

            if (!result.records[0]) return null;

            const record = result.records[0];
            const envelopes = record.get("envelopes");

            const parsed: Record<string, any> = {};
            for (const node of envelopes) {
                const props = node.properties;
                parsed[props.ontology] = deserializeValue(props.value, props.valueType);
            }

            return parsed;
        } catch (error) {
            console.error("[NOTIF] Failed to fetch chat data:", error);
            return null;
        }
    }
}
