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

        const globalChatId = payload.chatId || "";
        if (!globalChatId) {
            console.log("Message notification skipped: no chatId in payload");
            return;
        }

        // Look up the chat MetaEnvelope to find participants, admins, and owner
        const chatData = await this.getChatData(globalChatId);
        if (!chatData) {
            console.log(
                `Message notification skipped: chat ${globalChatId} not found`
            );
            return;
        }

        // Merge all participant arrays: participantIds + admins + owner
        const allParticipants = new Set<string>();

        if (Array.isArray(chatData.participantIds)) {
            for (const p of chatData.participantIds) {
                if (p) allParticipants.add(String(p));
            }
        }
        if (Array.isArray(chatData.admins)) {
            for (const a of chatData.admins) {
                if (a) allParticipants.add(String(a));
            }
        }
        if (chatData.owner) {
            allParticipants.add(String(chatData.owner));
        }

        // Remove the sender
        allParticipants.delete(senderEName);

        const recipients = [...allParticipants];

        if (recipients.length === 0) {
            return;
        }

        const messageText = payload.content || payload.text || "";
        const truncatedText =
            messageText.length > 100
                ? messageText.substring(0, 100) + "..."
                : messageText;

        const senderDisplay = senderEName.startsWith("@")
            ? senderEName
            : `@${senderEName}`;

        // Determine DM vs group based on total participant count
        const isDM = allParticipants.size <= 1; // only 1 left after removing sender = 2 people total

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

        if (failed > 0) {
            console.log(
                `Message notifications: ${succeeded} sent, ${failed} failed (message: ${messageGlobalId})`
            );
        }
    }

    private async getChatData(
        globalChatId: string
    ): Promise<Record<string, any> | null> {
        try {
            // Query Neo4j directly for the chat MetaEnvelope by ID
            // We don't filter by eName since this is an internal operation
            // and the chat may be stored under any participant's eName
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

            // Parse envelopes into a flat object
            const parsed: Record<string, any> = {};
            for (const node of envelopes) {
                const props = node.properties;
                parsed[props.ontology] = deserializeValue(
                    props.value,
                    props.valueType
                );
            }

            return parsed;
        } catch (error) {
            console.error("Failed to fetch chat data for notification:", error);
            return null;
        }
    }
}
