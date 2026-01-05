import { Request, Response } from "express";
import { UserService } from "../services/UserService";
import { GroupService } from "../services/GroupService";
import { MessageService } from "../services/MessageService";
import { Web3Adapter } from "web3-adapter";
import { User } from "../database/entities/User";
import { Group } from "../database/entities/Group";
import { Message } from "../database/entities/Message";
import axios from "axios";

export class WebhookController {
    userService: UserService;
    groupService: GroupService;
    messageService: MessageService;
    adapter: Web3Adapter;

    constructor(adapter: Web3Adapter) {
        this.userService = new UserService();
        this.groupService = new GroupService();
        this.messageService = new MessageService();
        this.adapter = adapter;
    }

    handleWebhook = async (req: Request, res: Response) => {
        try {
            if (process.env.ANCHR_URL) {
                axios.post(
                    new URL("file-manager", process.env.ANCHR_URL).toString(),
                    req.body
                );
            }
            const schemaId = req.body.schemaId;
            const globalId = req.body.id;
            const mapping = Object.values(this.adapter.mapping).find(
                (m) => m.schemaId === schemaId
            );
            this.adapter.addToLockedIds(globalId);

            if (!mapping) {
                return res.status(400).json({ error: "Unknown schema" });
            }

            const local = await this.adapter.fromGlobal({
                data: req.body.data,
                mapping,
            });

            let localId = await this.adapter.mappingDb.getLocalId(globalId);

            if (mapping.tableName === "users") {
                if (localId) {
                    const user = await this.userService.findById(localId);
                    if (!user) throw new Error("User not found");

                    for (const key of Object.keys(local.data)) {
                        // @ts-ignore
                        user[key] = local.data[key] ?? user[key];
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
                    const { user } = await this.userService.findOrCreateUser(
                        req.body.w3id
                    );
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
                }
            } else if (mapping.tableName === "groups") {
                let participants: User[] = [];
                if (
                    local.data.participants &&
                    Array.isArray(local.data.participants)
                ) {
                    const participantPromises = local.data.participants.map(
                        async (ref: string) => {
                            if (ref && typeof ref === "string") {
                                const userId = ref.split("(")[1].split(")")[0];
                                return await this.userService.getUserById(userId);
                            }
                            return null;
                        }
                    );

                    participants = (
                        await Promise.all(participantPromises)
                    ).filter((user: User | null): user is User => user !== null);
                }

                let adminIds = local?.data?.admins as string[] ?? []
                adminIds = adminIds.map((a) => a.includes("(") ? a.split("(")[1].split(")")[0]: a)

                if (localId) {
                    const group = await this.groupService.getGroupById(localId);
                    if (!group) {
                        return res.status(500).send();
                    }

                    group.name = local.data.name as string;
                    group.description = local.data.description as string;
                    group.owner = local.data.owner as string;
                    group.admins = adminIds.map(id => ({ id } as User));
                    group.participants = participants;
                    group.charter = local.data.charter as string;
                    group.ename = local.data.ename as string;
                    if (local.data.originalMatchParticipants) {
                        group.originalMatchParticipants = local.data.originalMatchParticipants as string[];
                    }

                    this.adapter.addToLockedIds(localId);
                    await this.groupService.groupRepository.save(group);
                    localId = group.id;
                } else {
                    // Check if a group with the same name and description already exists
                    // This prevents duplicate group creation from junction table webhooks
                    const existingGroup = await this.groupService.groupRepository.findOne({
                        where: {
                            name: local.data.name as string,
                            description: local.data.description as string
                        }
                    });

                    if (existingGroup) {
                        this.adapter.addToLockedIds(existingGroup.id);
                        await this.adapter.mappingDb.storeMapping({
                            localId: existingGroup.id,
                            globalId: req.body.id,
                        });
                        localId = existingGroup.id;
                    } else {
                        const group = await this.groupService.createGroup(
                            local.data.name as string,
                            local.data.description as string,
                            local.data.owner as string,
                            adminIds,
                            participants.map(p => p.id),
                            local.data.charter as string | undefined,
                            local.data.isPrivate as boolean | undefined,
                            local.data.visibility as "public" | "private" | "restricted" | undefined,
                            local.data.avatarUrl as string | undefined,
                            local.data.bannerUrl as string | undefined,
                            local.data.originalMatchParticipants as string[] | undefined,
                        );
                        this.adapter.addToLockedIds(group.id);
                        await this.adapter.mappingDb.storeMapping({
                            localId: group.id,
                            globalId: req.body.id,
                        });
                        localId = group.id;
                    }
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
                }
            }

            res.status(200).json({ success: true });
        } catch (error) {
            console.error("Error handling webhook:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
}

