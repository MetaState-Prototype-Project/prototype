import { Request, Response } from "express";
import { Web3Adapter } from "../../../../infrastructure/web3-adapter/src/index";
import { AppDataSource } from "../database/data-source";
import { User } from "../database/entities/User";
import { Poll } from "../database/entities/Poll";
import { Vote } from "../database/entities/Vote";
import { MetaEnvelopeMap } from "../database/entities/MetaEnvelopeMap";

export class WebhookController {
    private adapter: Web3Adapter;
    private userRepository = AppDataSource.getRepository(User);
    private pollRepository = AppDataSource.getRepository(Poll);
    private voteRepository = AppDataSource.getRepository(Vote);
    private mappingRepository = AppDataSource.getRepository(MetaEnvelopeMap);

    constructor(adapter: Web3Adapter) {
        this.adapter = adapter;
    }

    handleWebhook = async (req: Request, res: Response) => {
        try {
            const { data, entityType } = req.body;

            if (!data || !entityType) {
                return res.status(400).json({ error: "Missing data or entityType" });
            }

            console.log(`Webhook received for ${entityType}:`, data);

            const existingMapping = await this.mappingRepository.findOne({
                where: { globalId: data.id, entityType }
            });

            if (existingMapping) {
                console.log(`Entity ${entityType} with global ID ${data.id} already exists locally`);
                return res.status(200).json({ message: "Entity already exists" });
            }

            const localId = await this.createLocalEntity(entityType, data);

            if (localId) {
                await this.mappingRepository.save({
                    localId,
                    globalId: data.id,
                    entityType,
                    platform: process.env.PUBLIC_EVOTING_BASE_URL || "evoting"
                });

                console.log(`Created local ${entityType} with ID ${localId} for global ID ${data.id}`);
            }

            res.status(200).json({ message: "Webhook processed successfully" });
        } catch (error) {
            console.error("Error processing webhook:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    private async createLocalEntity(entityType: string, data: any): Promise<string | null> {
        try {
            switch (entityType) {
                case "User":
                    const user = this.userRepository.create({
                        ename: data.ename,
                        name: data.name || data.ename,
                        handle: data.handle || data.ename,
                        description: data.description,
                        avatarUrl: data.avatarUrl,
                        bannerUrl: data.bannerUrl,
                        isVerified: data.isVerified || false,
                        isPrivate: data.isPrivate || false,
                        email: data.email,
                        emailVerified: data.emailVerified || false,
                    });
                    const savedUser = await this.userRepository.save(user);
                    return savedUser.id;

                case "Poll":
                    const poll = this.pollRepository.create({
                        title: data.title,
                        mode: data.mode || "normal",
                        visibility: data.visibility || "public",
                        options: data.options || [],
                        deadline: data.deadline ? new Date(data.deadline) : null,
                        creatorId: data.creatorId,
                    });
                    const savedPoll = await this.pollRepository.save(poll);
                    return savedPoll.id;

                case "Vote":
                    const vote = this.voteRepository.create({
                        pollId: data.pollId,
                        userId: data.userId,
                        voterId: data.voterId,
                        data: data.data,
                    });
                    const savedVote = await this.voteRepository.save(vote);
                    return savedVote.id;

                default:
                    console.log(`Unknown entity type: ${entityType}`);
                    return null;
            }
        } catch (error) {
            console.error(`Error creating local ${entityType}:`, error);
            return null;
        }
    }
}