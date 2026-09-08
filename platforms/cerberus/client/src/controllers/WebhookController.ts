import { Request, Response } from "express";
import { UserService } from "../services/UserService";
import { GroupService } from "../services/GroupService";
import { MessageService } from "../services/MessageService";
import { CerberusTriggerService } from "../services/CerberusTriggerService";
import { CharterSignatureService } from "../services/CharterSignatureService";
import { Web3Adapter, resolveENameRef, resolveENameRefs } from "web3-adapter";
import { User } from "../database/entities/User";
import { Group } from "../database/entities/Group";
import { Message } from "../database/entities/Message";
import axios from "axios";

export class WebhookController {
    userService: UserService;
    groupService: GroupService;
    messageService: MessageService;
    cerberusTriggerService: CerberusTriggerService;
    charterSignatureService: CharterSignatureService;
    adapter: Web3Adapter;

    constructor(adapter: Web3Adapter) {
        this.userService = new UserService();
        this.groupService = new GroupService();
        this.messageService = new MessageService();
        this.cerberusTriggerService = new CerberusTriggerService();
        this.charterSignatureService = new CharterSignatureService();
        this.adapter = adapter;
    }

    handleWebhook = async (req: Request, res: Response) => {
        try {
            if (process.env.ANCHR_URL) {
                axios.post(
                    new URL("cerberus", process.env.ANCHR_URL).toString(),
                    req.body
                );
            }

            const schemaId = req.body.schemaId;
            const globalId = req.body.id;
            const mapping = Object.values(this.adapter.mapping).find(
                (m) => m.schemaId === schemaId
            );

            console.log("Found mapping:", mapping?.tableName);
            console.log("Available mappings:", Object.keys(this.adapter.mapping));

            if (!mapping) {
                console.log(
                    `[webhook] skipping unknown schema ${schemaId} for ${globalId}`
                );
                return res.status(200).send();
            }

            // Check if this globalId is already locked (being processed)
            if (this.adapter.lockedIds.includes(globalId)) {
                console.log("GlobalId already locked, skipping:", globalId);
                return res.status(200).send();
            }

            this.adapter.addToLockedIds(globalId);

            const local = await this.adapter.fromGlobal({
                data: req.body.data,
                mapping,
            });

            let localId = await this.adapter.mappingDb.getLocalId(globalId);
            console.log("Local ID for globalId", globalId, ":", localId);

            if (mapping.tableName === "users") {
                if (localId) {
                    const user = await this.userService.getUserById(localId);
                    if (!user) throw new Error();

                    for (const key of Object.keys(local.data)) {
                        // @ts-ignore
                        user[key] = local.data[key];
                    }
                    user.name = req.body.data.displayName;
                    await this.userService.userRepository.save(user);
                    await this.adapter.mappingDb.storeMapping({
                        localId: user.id,
                        globalId: req.body.id,
                    });
                    this.adapter.addToLockedIds(user.id);
                    this.adapter.addToLockedIds(globalId);
                } else {
                    const user = await this.userService.createUser({
                        ename: req.body.w3id,
                        name: req.body.data.displayName,
                        handle: req.body.data.username,
                        description: req.body.data.bio,
                        avatarUrl: req.body.data.avatarUrl,
                        bannerUrl: req.body.data.bannerUrl,
                        isVerified: req.body.data.isVerified,
                        isPrivate: req.body.data.isPrivate,
                    });

                    await this.adapter.mappingDb.storeMapping({
                        localId: user.id,
                        globalId: req.body.id,
                    });
                    this.adapter.addToLockedIds(user.id);
                    this.adapter.addToLockedIds(globalId);
                }
            } else if (mapping.tableName === "groups") {
                console.log("Processing group with data:", local.data);
                console.log("Global ID:", globalId);
                console.log("Local ID from mapping:", localId);

                let participants: User[] = [];
                if (local.data.participants !== undefined) {
                    // A slow or missing user must not hang the webhook, so each
                    // lookup keeps its own timeout; the shared resolver turns a
                    // rejection into a skipped participant rather than a lost room.
                    participants = await resolveENameRefs<User>(
                        local.data.participants,
                        (ename) => withTimeout(
                            this.userService.getUserByEname(ename),
                            5000,
                            `loading user ${ename}`
                        ),
                        { context: `group ${globalId} participants` }
                    );
                    console.log(`Found ${participants.length} participants`);
                }

                // `admins` and `owner` are eNames on the wire but local user ids
                // in the columns, so they are resolved back. Anyone this instance
                // does not know is skipped rather than stored as a dangling id.
                const adminUsers = await resolveENameRefs<User>(
                    local?.data?.admins,
                    (ename) => this.userService.getUserByEname(ename),
                    { context: `group ${globalId} admins` }
                );
                const admins = adminUsers.map((a) => a.id);

                const ownerUser = await resolveENameRef<User>(
                    local?.data?.owner,
                    (ename) => this.userService.getUserByEname(ename),
                    { context: `group ${globalId} owner` }
                );

                if (localId) {
                    const group = await this.groupService.getGroupById(localId);
                    if (!group) {
                        console.error("Group not found for localId:", localId);
                        return res.status(500).send();
                    }

                    // Store old charter for change detection
                    const oldCharter = group.charter;
                    const newCharter = local.data.charter as string;

                    // Only update fields that are actually present in the webhook (partial update)
                    if (local.data.name !== undefined) {
                        group.name = local.data.name as string;
                    }
                    if (local.data.description !== undefined) {
                        group.description = local.data.description as string;
                    }
                    if (ownerUser) {
                        group.owner = ownerUser.id;
                    }
                    if (admins.length > 0) {
                        group.admins = admins;
                    }
                    if (participants && participants.length > 0) {
                        group.participants = participants;
                    }
                    if (local.data.ename !== undefined) {
                        group.ename = local.data.ename as string;
                    }
                    if (newCharter !== undefined && newCharter !== null) {
                        group.charter = newCharter;
                    }

                    this.adapter.addToLockedIds(localId);
                    await this.groupService.groupRepository.save(group);

                    // Only process if there's actually a charter change, not just a message update
                    if (newCharter !== undefined && newCharter !== null && oldCharter !== newCharter) {
                        // Don't await - let it run asynchronously to avoid blocking webhook response
                        this.cerberusTriggerService.processCharterChange(
                            group.id,
                            group.name,
                            oldCharter,
                            newCharter
                        ).catch((error) => {
                            console.error("Error in processCharterChange:", error);
                        });
                    }
                } else {
                    // Check if group already exists by ename (only if ename is available)
                    let group;
                    if (local.data.ename) {
                        group = await this.groupService.groupRepository.findOne({
                            where: { ename: local.data.ename as string },
                            relations: ["participants"]
                        });
                    }

                    if (group) {
                        // Group exists, just store the mapping
                        this.adapter.addToLockedIds(group.id);
                        await this.adapter.mappingDb.storeMapping({
                            localId: group.id,
                            globalId: req.body.id,
                        });
                    } else {
                        // Create new group
                        group = await this.groupService.createGroup({
                            name: local.data.name as string,
                            description: local.data.description as string,
                            owner: ownerUser?.id as string,
                            admins,
                            participants: participants,
                            charter: local.data.charter as string,
                            ename: local.data.ename as string
                        });

                        this.adapter.addToLockedIds(group.id);
                        await this.adapter.mappingDb.storeMapping({
                            localId: group.id,
                            globalId: req.body.id,
                        });

                        // Check if new group has a charter and send Cerberus welcome message
                        if (group.charter) {
                            // Don't await - let it run asynchronously to avoid blocking webhook response
                            this.cerberusTriggerService.processCharterChange(
                                group.id,
                                group.name,
                                undefined, // No old charter for new groups
                                group.charter
                            ).catch((error) => {
                                console.error("Error in processCharterChange for new group:", error);
                            });
                        }
                    }
                }
            } else if (mapping.tableName === "messages") {
                console.log("Processing message with data:", local.data);

                // Extract sender and group from the message data
                let sender: User | null = null;
                let group: Group | null = null;

                sender = await resolveENameRef<User>(
                    local.data.sender,
                    (ename) => this.userService.getUserByEname(ename),
                    { context: `message ${globalId} sender` }
                );

                if (local.data.group && typeof local.data.group === "string") {
                    const groupId = local.data.group.split("(")[1].split(")")[0];
                    group = await this.groupService.getGroupById(groupId);
                }

                // Check if this is a system message (no sender required)
                const isSystemMessage = local.data.isSystemMessage === true ||
                    (local.data.text && typeof local.data.text === 'string' && local.data.text.startsWith('$$system-message$$'));

                if (!group) {
                    console.error("Group not found for message");
                    return res.status(500).send();
                }

                // For system messages, sender can be null
                if (!isSystemMessage && !sender) {
                    console.error("Sender not found for non-system message");
                    return res.status(500).send();
                }

                if (localId) {
                    console.log("Updating existing message with localId:", localId);
                    const message = await this.messageService.getMessageById(localId);
                    if (!message) {
                        console.error("Message not found for localId:", localId);
                        return res.status(500).send();
                    }

                    // For system messages, ensure the prefix is preserved
                    if (isSystemMessage && !(local.data.text as string).startsWith('$$system-message$$')) {
                        message.text = `$$system-message$$ ${local.data.text as string}`;
                    } else {
                        message.text = local.data.text as string;
                    }
                    message.sender = sender;
                    message.group = group;
                    message.isSystemMessage = isSystemMessage as boolean;

                    this.adapter.addToLockedIds(localId);
                    await this.messageService.messageRepository.save(message);
                    console.log("Updated message:", message.id);
                } else {
                    console.log("Creating new message");
                    let message: Message;

                    if (isSystemMessage) {
                        message = await this.messageService.createSystemMessageWithoutPrefix({
                            text: local.data.text as string,
                            groupId: group.id,
                        });
                    } else {
                        message = await this.messageService.createMessage({
                            text: local.data.text as string,
                            senderId: sender!.id, // We know sender exists for non-system messages
                            groupId: group.id,
                        });
                    }

                    console.log("Created message with ID:", message.id);
                    this.adapter.addToLockedIds(message.id);
                    await this.adapter.mappingDb.storeMapping({
                        localId: message.id,
                        globalId: req.body.id,
                    });
                    console.log("Stored mapping for message:", message.id, "->", req.body.id);

                    // Check if this is a Cerberus trigger message
                    if (this.cerberusTriggerService.isCerberusTrigger(message.text)) {
                        console.log("🚨 Cerberus trigger detected!");

                        // Process the trigger asynchronously (don't block the webhook response)
                        this.cerberusTriggerService.processCerberusTrigger(message)
                            .then(() => {
                                console.log("✅ Cerberus trigger processing completed");
                            })
                            .catch((error) => {
                                console.error("❌ Error processing Cerberus trigger:", error);
                            });
                    }
                }
            } else if (mapping.tableName === "charter_signatures") {
                console.log("Processing charter signature with data:", local.data);

                // Extract group and user from the signature data
                let group: Group | null = null;
                let user: User | null = null;

                // Parse groupId from relation string like "groups(cd8e7ce1-ca76-4564-8fb8-1cbb5c3d1917)"
                if (local.data.groupId && typeof local.data.groupId === "string") {
                    const groupId = local.data.groupId.split("(")[1].split(")")[0];
                    console.log("Extracted groupId:", groupId);
                    group = await this.groupService.getGroupById(groupId);
                }

                // Parse userId from relation string like "users(userId)" or handle null case
                if (local.data.userId && typeof local.data.userId === "string") {
                    const userId = local.data.userId.split("(")[1].split(")")[0];
                    console.log("Extracted userId:", userId);
                    user = await this.userService.getUserById(userId);
                } else if (local.data.userId === null) {
                    console.log("userId is null, skipping user lookup");
                    // For now, we'll create the signature without a user - you might want to handle this differently
                }

                if (!group) {
                    console.error("Group not found for charter signature");
                    return res.status(500).send();
                }

                if (!user) {
                    console.error("User not found for charter signature - userId was null or invalid");
                    return res.status(500).send();
                }

                if (localId) {
                    console.log("Updating existing charter signature with localId:", localId);
                    // For now, we'll just log that we're updating
                    // You might want to add update logic here if needed
                    console.log("Charter signature update not yet implemented");
                } else {
                    console.log("Creating new charter signature");

                    // Create the charter signature using the service
                    const charterSignature = await this.charterSignatureService.createCharterSignature({
                        data: {
                            id: req.body.id,
                            group: group.id,
                            user: user.id,
                            charterHash: local.data.charterHash,
                            signature: local.data.signature,
                            publicKey: local.data.publicKey,
                            message: local.data.message,
                            createdAt: local.data.createdAt,
                            updatedAt: local.data.updatedAt,
                        }
                    });

                    console.log("Created charter signature with ID:", charterSignature.id);
                    this.adapter.addToLockedIds(charterSignature.id);
                    await this.adapter.mappingDb.storeMapping({
                        localId: charterSignature.id,
                        globalId: req.body.id,
                    });
                    console.log("Stored mapping for charter signature:", charterSignature.id, "->", req.body.id);

                    // Analyze charter activation after new signature
                    try {
                        await this.charterSignatureService.analyzeCharterActivation(
                            group.id,
                            this.messageService
                        );
                    } catch (error) {
                        console.error("Error analyzing charter activation:", error);
                    }
                }
            }
            res.status(200).send();
        } catch (e) {
            console.error("Webhook error:", e);
            res.status(500).send();
        }
    };
}

/**
 * Rejects if a lookup takes too long.
 *
 * Cerberus resolves participants during webhook handling, where a slow user
 * query would otherwise hold the request open; the caller treats a rejection as
 * one skipped participant.
 */
function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    description: string
): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout ${description}`)), ms)
        ),
    ]);
}
