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
            console.log("here")
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
            console.log(mapping, this.adapter.mapping, schemaId)
            this.adapter.addToLockedIds(globalId);

            if (!mapping) throw new Error();
            const local = await this.adapter.fromGlobal({
                data: req.body.data,
                mapping,
            });

            let localId = await this.adapter.mappingDb.getLocalId(globalId);

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
                let participants: User[] = [];
                if (
                    local.data.participants &&
                    Array.isArray(local.data.participants)
                ) {
                    console.log(local);
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
                    ).filter((user): user is User => user !== null);
                }

                if (localId) {
                    const group = await this.groupService.getGroupById(localId);
                    if (!group) return res.status(500).send();

                    group.name = local.data.name as string;
                    group.description = local.data.description as string;
                    group.owner = local.data.owner as string;
                    group.admins = local.data.admins as string[];
                    group.participants = participants;

                    this.adapter.addToLockedIds(localId);
                    await this.groupService.groupRepository.save(group);
                } else {
                    const group = await this.groupService.createGroup({
                        name: local.data.name as string,
                        description: local.data.description as string,
                        owner: local.data.owner as string,
                        admins: local.data.admins as string[],
                        participants: participants,
                    });

                    this.adapter.addToLockedIds(group.id);
                    await this.adapter.mappingDb.storeMapping({
                        localId: group.id,
                        globalId: req.body.id,
                    });
                }
            }
            res.status(200).send();
        } catch (e) {
            console.error(e);
            res.status(500).send();
        }
    };
} 