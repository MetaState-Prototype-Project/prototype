import { Request, Response } from "express";
import { UserService } from "../services/UserService";
import { GroupService } from "../services/GroupService";
import { MessageService } from "../services/MessageService";
import { ConsentService } from "../services/ConsentService";
import { adapter } from "../web3adapter/watchers/subscriber";
import { User } from "../database/entities/User";
import { Group } from "../database/entities/Group";
import { Message } from "../database/entities/Message";
import axios from "axios";

export class WebhookController {
    userService: UserService;
    groupService: GroupService;
    messageService: MessageService;
    consentService: ConsentService;
    adapter: typeof adapter;

    constructor() {
        this.userService = new UserService();
        this.groupService = new GroupService();
        this.messageService = new MessageService();
        this.consentService = new ConsentService();
        this.adapter = adapter;
    }

    handleWebhook = async (req: Request, res: Response) => {
        try {
            console.log("DreamSync Webhook received:", {
                schemaId: req.body.schemaId,
                globalId: req.body.id,
                tableName: req.body.data?.tableName
            });

            if (process.env.ANCHR_URL) {
                axios.post(
                    new URL("dreamsync-api", process.env.ANCHR_URL).toString(),
                    req.body
                );
            }

            const schemaId = req.body.schemaId;
            const globalId = req.body.id;
            const mapping = Object.values(this.adapter.mapping).find(
                (m: any) => m.schemaId === schemaId
            ) as any;

            console.log("Found mapping:", mapping?.tableName);
            console.log("Available mappings:", Object.keys(this.adapter.mapping));

            if (!mapping) {
                console.error("No mapping found for schemaId:", schemaId);
                throw new Error("No mapping found");
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

                    // Only update simple properties, not relationships
                    const updateData: Partial<User> = {
                        name: req.body.data.displayName,
                        handle: local.data.username as string | undefined,
                        description: local.data.bio as string | undefined,
                        avatarUrl: local.data.avatarUrl as string | undefined,
                        bannerUrl: local.data.bannerUrl as string | undefined,
                        isVerified: local.data.isVerified as boolean | undefined,
                        isPrivate: local.data.isPrivate as boolean | undefined,
                        email: local.data.email as string | undefined,
                        emailVerified: local.data.emailVerified as boolean | undefined,
                    };

                    await this.userService.updateUser(user.id, updateData);
                    await this.adapter.mappingDb.storeMapping({
                        localId: user.id,
                        globalId: req.body.id,
                    });
                    this.adapter.addToLockedIds(user.id);
                    this.adapter.addToLockedIds(globalId);
                } else {
                    const user = await this.userService.createBlankUser(req.body.w3id);
                    
                    // Update user with webhook data
                    await this.userService.updateUser(user.id, {
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

                let participants: User[] = [];
                if (
                    local.data.participants &&
                    Array.isArray(local.data.participants)
                ) {
                    console.log("Processing participants:", local.data.participants);
                    const participantPromises = local.data.participants.map(
                        async (ref: string) => {
                            if (ref && typeof ref === "string") {
                                const userId = ref.split("(")[1].split(")")[0];
                                console.log("Extracted userId:", userId);
                                return await this.userService.getUserById(userId);
                            }
                            return null;
                        }
                    );

                    participants = (
                        await Promise.all(participantPromises)
                    ).filter((user: User | null): user is User => user !== null);
                    console.log("Found participants:", participants.length);
                }

                let adminIds = local?.data?.admins as string[] ?? []
                adminIds = adminIds.map((a) => a.includes("(") ? a.split("(")[1].split(")")[0]: a)

                if (localId) {
                    console.log("Updating existing group with localId:", localId);
                    const group = await this.groupService.getGroupById(localId);
                    if (!group) {
                        console.error("Group not found for localId:", localId);
                        return res.status(500).send();
                    }

                    group.name = local.data.name as string;
                    group.description = local.data.description as string;
                    group.owner = local.data.owner as string;
                    group.admins = adminIds.map(id => ({ id } as User));
                    group.participants = participants;
                    group.charter = local.data.charter as string;
                    group.ename = local.data.ename as string

                    this.adapter.addToLockedIds(localId);
                    await this.groupService.groupRepository.save(group);
                    console.log("Updated group:", group.id);
                } else {
                    console.log("Creating new group");
                    const group = await this.groupService.createGroup(
                        local.data.name as string,
                        local.data.description as string,
                        local.data.owner as string,
                        adminIds,
                        participants.map(p => p.id),
                        local.data.charter as string | undefined,
                    );
                    console.log("Created group with ID:", group.id);
                    console.log(group)
                    this.adapter.addToLockedIds(group.id);
                    await this.adapter.mappingDb.storeMapping({
                        localId: group.id,
                        globalId: req.body.id,
                    });
                    console.log("Stored mapping for group:", group.id, "->", req.body.id);
                }
            } else if (mapping.tableName === "messages") {
                console.log("Processing message with data:", local.data);

                // Extract sender and group from the message data
                let sender: User | null = null;
                let group: Group | null = null;

                if (local.data.sender && typeof local.data.sender === "string") {
                    const senderId = local.data.sender.split("(")[1].split(")")[0];
                    sender = await this.userService.getUserById(senderId);
                }

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
                    message.sender = sender || undefined;
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

                    // Check if this is a consent response (non-system message with "yes")
                    if (!isSystemMessage && message.text && message.text.toLowerCase().includes('yes')) {
                        console.log("🤝 WEBHOOK: Processing potential consent response");
                        try {
                            await this.consentService.processConsentResponse(
                                message.text,
                                message.sender!.id,
                                message.group.id
                            );
                        } catch (error) {
                            console.error("Error processing consent response in webhook:", error);
                        }
                    }
                }
            }
            res.status(200).send();
        } catch (e) {
            console.error("DreamSync Webhook error:", e);
            res.status(500).send();
        }
    };
}
