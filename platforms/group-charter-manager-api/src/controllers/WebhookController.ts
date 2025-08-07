import { Request, Response } from "express";
import { UserService } from "../services/UserService";
import { GroupService } from "../services/GroupService";
import { Web3Adapter } from "../../../../infrastructure/web3-adapter/src";
import { User } from "../database/entities/User";
import { Group } from "../database/entities/Group";
import axios from "axios";

export class WebhookController {
    userService: UserService;
    groupService: GroupService;
    adapter: Web3Adapter;

    constructor(adapter: Web3Adapter) {
        this.userService = new UserService();
        this.groupService = new GroupService();
        this.adapter = adapter;
    }

    handleWebhook = async (req: Request, res: Response) => {
        try {
            console.log("Webhook received:", {
                schemaId: req.body.schemaId,
                globalId: req.body.id,
                tableName: req.body.data?.tableName
            });

            if (process.env.ANCHR_URL) {
                axios.post(
                    new URL("group-charter-manager", process.env.ANCHR_URL).toString(),
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
                    ).filter((user): user is User => user !== null);
                    console.log("Found participants:", participants.length);
                }

                let admins = local?.data?.admins as string[] ?? []
                admins = admins.map((a) => a.includes("(") ? a.split("(")[1].split(")")[0]: a)

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
                    group.admins = admins;
                    group.participants = participants;

                    this.adapter.addToLockedIds(localId);
                    await this.groupService.groupRepository.save(group);
                    console.log("Updated group:", group.id);
                } else {
                    console.log("Creating new group");
                    const group = await this.groupService.createGroup({
                        name: local.data.name as string,
                        description: local.data.description as string,
                        owner: local.data.owner as string,
                        admins,
                        participants: participants,
                    });

                    console.log("Created group with ID:", group.id);
                    console.log(group)
                    this.adapter.addToLockedIds(group.id);
                    await this.adapter.mappingDb.storeMapping({
                        localId: group.id,
                        globalId: req.body.id,
                    });
                    console.log("Stored mapping for group:", group.id, "->", req.body.id);
                }
            }
            res.status(200).send();
        } catch (e) {
            console.error("Webhook error:", e);
            res.status(500).send();
        }
    };
} 