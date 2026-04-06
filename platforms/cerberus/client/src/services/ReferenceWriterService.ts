import { AppDataSource } from "../database/data-source";
import { Reference } from "../database/entities/Reference";
import { User } from "../database/entities/User";

interface ViolationReference {
    targetId: string;       // User ID of the violator
    targetName: string;     // Display name of the violator
    targetEname?: string;   // ename of the violator
    content: string;        // Description of the violation
    numericScore: number;   // 1-5 (1 = severe violation, 5 = minor)
}

export class ReferenceWriterService {
    private referenceRepository = AppDataSource.getRepository(Reference);
    private userRepository = AppDataSource.getRepository(User);
    private eReputationBaseUrl: string;
    private platformSecret: string;

    constructor() {
        this.eReputationBaseUrl = process.env.PUBLIC_EREPUTATION_BASE_URL || "http://localhost:8765";
        this.platformSecret = process.env.PLATFORM_SHARED_SECRET || "";
    }

    /**
     * Write violation references for users who violated the charter.
     * Writes to both local DB (for eVault sync) and eReputation API directly.
     */
    async writeViolationReferences(
        violations: ViolationReference[],
        groupId: string,
        groupName: string,
        authorId: string
    ): Promise<void> {
        for (const violation of violations) {
            try {
                // 1. Write to local DB (triggers web3adapter → eVault sync)
                await this.writeLocalReference(violation, authorId);

                // 2. Write directly to eReputation API
                await this.writeToEReputationApi(violation, authorId);

                console.log(`✅ Violation reference written for ${violation.targetName} (${violation.targetId})`);
            } catch (error) {
                console.error(`❌ Failed to write violation reference for ${violation.targetName}:`, error);
            }
        }
    }

    /**
     * Write reference to local Cerberus DB — the web3adapter subscriber
     * will pick it up and sync to eVault automatically.
     */
    private async writeLocalReference(violation: ViolationReference, authorId: string): Promise<Reference> {
        const reference = this.referenceRepository.create({
            targetType: "user",
            targetId: violation.targetId,
            targetName: violation.targetName,
            content: violation.content,
            referenceType: "violation",
            numericScore: violation.numericScore,
            authorId,
            status: "signed",
            anonymous: false
        });

        return await this.referenceRepository.save(reference);
    }

    /**
     * Write reference directly to eReputation API using the platform shared secret.
     */
    private async writeToEReputationApi(violation: ViolationReference, authorId: string): Promise<void> {
        if (!this.platformSecret) {
            console.warn("⚠️ PLATFORM_SHARED_SECRET not set, skipping eReputation API call");
            return;
        }

        try {
            const response = await fetch(`${this.eReputationBaseUrl}/api/references/system`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Platform-Secret": this.platformSecret
                },
                body: JSON.stringify({
                    targetType: "user",
                    targetId: violation.targetId,
                    targetName: violation.targetName,
                    targetEname: violation.targetEname,
                    content: violation.content,
                    referenceType: "violation",
                    numericScore: violation.numericScore,
                    authorId,
                    anonymous: false
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ eReputation API error (${response.status}): ${errorText}`);
            }
        } catch (error) {
            console.error("❌ Failed to call eReputation API:", error);
        }
    }

    /**
     * Resolve a user name/ename to their user ID in the local database.
     */
    async resolveUserId(nameOrEname: string): Promise<User | null> {
        // Try ename first
        let user = await this.userRepository.findOne({ where: { ename: nameOrEname } });
        if (user) return user;

        // Try name
        user = await this.userRepository.findOne({ where: { name: nameOrEname } });
        return user;
    }
}
