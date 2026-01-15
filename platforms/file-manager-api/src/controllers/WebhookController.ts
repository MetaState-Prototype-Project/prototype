import { Request, Response } from "express";
import { UserService } from "../services/UserService";
import { GroupService } from "../services/GroupService";
import { MessageService } from "../services/MessageService";
import { FileService } from "../services/FileService";
import { Web3Adapter } from "web3-adapter";
import { User } from "../database/entities/User";
import { Group } from "../database/entities/Group";
import { Message } from "../database/entities/Message";
import { File } from "../database/entities/File";
import { Folder } from "../database/entities/Folder";
import { SignatureContainer } from "../database/entities/SignatureContainer";
import { AppDataSource } from "../database/data-source";
import axios from "axios";

export class WebhookController {
    userService: UserService;
    groupService: GroupService;
    messageService: MessageService;
    fileService: FileService;
    adapter: Web3Adapter;
    fileRepository = AppDataSource.getRepository(File);
    signatureRepository = AppDataSource.getRepository(SignatureContainer);

    constructor(adapter: Web3Adapter) {
        this.userService = new UserService();
        this.groupService = new GroupService();
        this.messageService = new MessageService();
        this.fileService = new FileService();
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
            } else if (mapping.tableName === "files") {
                // Extract owner from the file data
                // ownerId might be a global reference or local ID
                let ownerId: string | null = null;
                if (local.data.ownerId && typeof local.data.ownerId === "string") {
                    // Check if it's a reference format like "users(uuid)"
                    if (local.data.ownerId.includes("(")) {
                        ownerId = local.data.ownerId.split("(")[1].split(")")[0];
                    } else {
                        ownerId = local.data.ownerId;
                    }
                }

                // Resolve global ownerId to local ownerId if needed
                if (ownerId) {
                    const localOwnerId = await this.adapter.mappingDb.getLocalId(ownerId);
                    ownerId = localOwnerId || ownerId;
                }

                const owner = ownerId ? await this.userService.getUserById(ownerId) : null;
                if (!owner) {
                    console.error("Owner not found for file");
                    return res.status(500).send();
                }

                // Handle folderId - may not exist in esigner-api, so set to null if not found
                let folderId: string | null = null;
                if (local.data.folderId && local.data.folderId !== null) {
                    if (typeof local.data.folderId === "string" && local.data.folderId.includes("(")) {
                        // It's a reference, but folders don't sync, so ignore
                        folderId = null;
                    } else if (typeof local.data.folderId === "string") {
                        // Check if folder exists locally
                        const folderRepository = AppDataSource.getRepository(Folder);
                        const folder = await folderRepository.findOne({ where: { id: local.data.folderId } });
                        folderId = folder ? folder.id : null;
                    }
                }

                if (localId) {
                    // Update existing file
                    const file = await this.fileRepository.findOne({
                        where: { id: localId },
                    });
                    if (!file) {
                        console.error("File not found for localId:", localId);
                        return res.status(500).send();
                    }

                    file.name = local.data.name as string;
                    file.displayName = local.data.displayName as string | null;
                    file.description = local.data.description as string | null;
                    file.mimeType = local.data.mimeType as string;
                    file.size = local.data.size as number;
                    file.md5Hash = local.data.md5Hash as string;
                    file.ownerId = owner.id;
                    file.folderId = folderId;
                    
                    // Decode base64 data if provided
                    if (local.data.data && typeof local.data.data === "string") {
                        file.data = Buffer.from(local.data.data, "base64");
                    }

                    this.adapter.addToLockedIds(localId);
                    await this.fileRepository.save(file);
                } else {
                    // Create new file with binary data
                    // Decode base64 data if provided
                    let fileData: Buffer = Buffer.alloc(0);
                    if (local.data.data && typeof local.data.data === "string") {
                        fileData = Buffer.from(local.data.data, "base64");
                    }
                    
                    const file = this.fileRepository.create({
                        name: local.data.name as string,
                        displayName: local.data.displayName as string | null,
                        description: local.data.description as string | null,
                        mimeType: local.data.mimeType as string,
                        size: local.data.size as number,
                        md5Hash: local.data.md5Hash as string,
                        ownerId: owner.id,
                        folderId: folderId,
                        data: fileData,
                    });

                    this.adapter.addToLockedIds(file.id);
                    await this.fileRepository.save(file);
                    await this.adapter.mappingDb.storeMapping({
                        localId: file.id,
                        globalId: req.body.id,
                    });
                    localId = file.id;
                }
            } else if (mapping.tableName === "signature_containers") {
                // Extract file and user from the signature data
                let file: File | null = null;
                let user: User | null = null;

                // Resolve fileId - might be global reference
                let fileId: string | null = null;
                if (local.data.fileId && typeof local.data.fileId === "string") {
                    if (local.data.fileId.includes("(")) {
                        const fileGlobalId = local.data.fileId.split("(")[1].split(")")[0];
                        const fileLocalId = await this.adapter.mappingDb.getLocalId(fileGlobalId);
                        fileId = fileLocalId || fileGlobalId;
                    } else {
                        fileId = local.data.fileId;
                    }
                }

                // Resolve userId - might be global reference
                let userId: string | null = null;
                if (local.data.userId && typeof local.data.userId === "string") {
                    if (local.data.userId.includes("(")) {
                        userId = local.data.userId.split("(")[1].split(")")[0];
                    } else {
                        userId = local.data.userId;
                    }
                }

                // Resolve global IDs to local IDs
                if (fileId) {
                    const localFileId = await this.adapter.mappingDb.getLocalId(fileId);
                    fileId = localFileId || fileId;
                }
                if (userId) {
                    const localUserId = await this.adapter.mappingDb.getLocalId(userId);
                    userId = localUserId || userId;
                }

                file = fileId ? await this.fileRepository.findOne({ where: { id: fileId } }) : null;
                user = userId ? await this.userService.getUserById(userId) : null;

                if (!file || !user) {
                    console.error("File or user not found for signature");
                    return res.status(500).send();
                }

                if (localId) {
                    // Update existing signature
                    const signature = await this.signatureRepository.findOne({
                        where: { id: localId },
                    });
                    if (!signature) {
                        console.error("Signature not found for localId:", localId);
                        return res.status(500).send();
                    }

                    signature.fileId = file.id;
                    signature.userId = user.id;
                    signature.md5Hash = local.data.md5Hash as string;
                    signature.signature = local.data.signature as string;
                    signature.publicKey = local.data.publicKey as string;
                    signature.message = local.data.message as string;

                    this.adapter.addToLockedIds(localId);
                    await this.signatureRepository.save(signature);
                } else {
                    // Create new signature
                    const signature = this.signatureRepository.create({
                        fileId: file.id,
                        userId: user.id,
                        md5Hash: local.data.md5Hash as string,
                        signature: local.data.signature as string,
                        publicKey: local.data.publicKey as string,
                        message: local.data.message as string,
                    });

                    this.adapter.addToLockedIds(signature.id);
                    await this.signatureRepository.save(signature);
                    await this.adapter.mappingDb.storeMapping({
                        localId: signature.id,
                        globalId: req.body.id,
                    });
                    localId = signature.id;
                }
            }

            res.status(200).json({ success: true });
        } catch (error) {
            console.error("Error handling webhook:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
}

