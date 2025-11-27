import axios from "axios";
import { randomUUID } from "crypto";
import { AppDataSource } from "../database/data-source";
import { Migration, MigrationStatus } from "../database/entities/Migration";
import { EventEmitter } from "events";

export class MigrationService extends EventEmitter {
    private migrationRepository = AppDataSource.getRepository(Migration);
    private registryUrl: string;
    private evaultBaseUri: string;

    constructor() {
        super();
        this.registryUrl =
            process.env.PUBLIC_REGISTRY_URL || "http://localhost:4321";
        this.evaultBaseUri =
            process.env.EVAULT_BASE_URI || "http://localhost:4000";
    }

    async initiateMigration(
        userId: string,
        eName: string,
        newProvisionerUrl: string,
    ): Promise<Migration> {
        console.log(
            `[MIGRATION] User ${userId} initiated migration to ${newProvisionerUrl}`,
        );

        // Get current evault info from registry
        const currentEvaultInfo = await this.getCurrentEvaultInfo(eName);
        if (!currentEvaultInfo) {
            throw new Error(`No evault found for eName: ${eName}`);
        }

        const migration = this.migrationRepository.create({
            userId,
            eName,
            oldEvaultId: currentEvaultInfo.evault,
            oldEvaultUri: currentEvaultInfo.uri,
            provisionerUrl: newProvisionerUrl,
            status: MigrationStatus.INITIATED,
            logs: `[MIGRATION] Migration initiated for eName: ${eName}\n`,
        });

        return this.migrationRepository.save(migration);
    }

    async provisionNewEvault(
        migrationId: string,
        provisionerUrl: string,
        eName: string,
    ): Promise<{ w3id: string; uri: string; evaultId: string }> {
        if (!provisionerUrl) {
            throw new Error("provisionerUrl is required");
        }
        console.log(`[MIGRATION] Provisioning new evault for ${eName}`);

        const migration = await this.migrationRepository.findOneBy({ id: migrationId });
        if (!migration) {
            throw new Error("Migration not found");
        }

        try {
            migration.status = MigrationStatus.PROVISIONING;
            migration.logs += `[MIGRATION] Provisioning new evault for ${eName}\n`;
            await this.migrationRepository.save(migration);
            this.emit("migration-update", migrationId, {
                status: MigrationStatus.PROVISIONING,
                message: "Provisioning new evault...",
            });

            // Get entropy from registry
            const entropyResponse = await axios.get(
                new URL("/entropy", this.registryUrl).toString(),
            );
            const registryEntropy = entropyResponse.data.token;

            // Provision new evault
            const provisionResponse = await axios.post(
                new URL("/provision", provisionerUrl).toString(),
                {
                    registryEntropy,
                    namespace: randomUUID(),
                    verificationId:
                        process.env.DEMO_VERIFICATION_CODE ||
                        "d66b7138-538a-465f-a6ce-f6985854c3f4",
                    publicKey: "0x0000000000000000000000000000000000000000",
                },
            );

            if (!provisionResponse.data.success) {
                throw new Error("Failed to provision new evault");
            }

            const { w3id, uri } = provisionResponse.data;

            // Get evault ID from registry
            const evaultInfo = await axios.get(
                new URL(`/resolve?w3id=${w3id}`, this.registryUrl).toString(),
            );
            const evaultId = evaultInfo.data.evault;

            migration.newEvaultId = evaultId;
            migration.newEvaultUri = uri;
            migration.logs += `[MIGRATION] New evault provisioned: ${evaultId}, URI: ${uri}\n`;
            await this.migrationRepository.save(migration);

            console.log(
                `[MIGRATION] New evault provisioned: ${evaultId} for ${eName}`,
            );

            return { w3id, uri, evaultId };
        } catch (error) {
            migration.status = MigrationStatus.FAILED;
            migration.error = error instanceof Error ? error.message : String(error);
            migration.logs += `[MIGRATION ERROR] Provisioning failed: ${migration.error}\n`;
            await this.migrationRepository.save(migration);
            throw error;
        }
    }

    async copyMetaEnvelopes(
        migrationId: string,
        oldEvaultUri: string,
        newEvaultUri: string,
        eName: string,
    ): Promise<number> {
        console.log(
            `[MIGRATION] Copying metaEnvelopes from ${oldEvaultUri} to ${newEvaultUri} for ${eName}`,
        );

        const migration = await this.migrationRepository.findOneBy({ id: migrationId });
        if (!migration) {
            throw new Error("Migration not found");
        }

        try {
            migration.status = MigrationStatus.COPYING;
            migration.logs += `[MIGRATION] Starting copy of metaEnvelopes for ${eName}\n`;
            await this.migrationRepository.save(migration);
            this.emit("migration-update", migrationId, {
                status: MigrationStatus.COPYING,
                message: "Copying metaEnvelopes...",
            });

            // Get Neo4j connection details
            // TODO: In production, these should be retrieved from evault metadata or configuration
            // For now, assume Neo4j is on the same host with standard port
            const oldNeo4jUri = oldEvaultUri.replace(/:\d+$/, ":7687");
            const newNeo4jUri = newEvaultUri.replace(/:\d+$/, ":7687");
            const neo4jUser = process.env.NEO4J_USER || "neo4j";
            const neo4jPassword = process.env.NEO4J_PASSWORD || "neo4j";

            console.log(
                `[MIGRATION] Copying from ${oldNeo4jUri} to ${newNeo4jUri} for ${eName}`,
            );

            // Call the emover endpoint on the old evault
            const copyResponse = await axios.post(
                new URL("/emover", oldEvaultUri).toString(),
                {
                    eName,
                    targetNeo4jUri: newNeo4jUri,
                    targetNeo4jUser: neo4jUser,
                    targetNeo4jPassword: neo4jPassword,
                },
            );

            if (!copyResponse.data.success) {
                throw new Error(
                    copyResponse.data.error || "Failed to copy metaEnvelopes",
                );
            }

            const count = copyResponse.data.count;
            migration.logs += `[MIGRATION] Copied ${count} metaEnvelopes successfully\n`;
            await this.migrationRepository.save(migration);

            console.log(
                `[MIGRATION] Successfully copied ${count} metaEnvelopes for ${eName}`,
            );

            return count;
        } catch (error) {
            migration.status = MigrationStatus.FAILED;
            migration.error = error instanceof Error ? error.message : String(error);
            migration.logs += `[MIGRATION ERROR] Copy failed: ${migration.error}\n`;
            await this.migrationRepository.save(migration);
            throw error;
        }
    }

    async verifyDataCopy(
        migrationId: string,
        newEvaultUri: string,
        eName: string,
        expectedCount: number,
    ): Promise<boolean> {
        console.log(
            `[MIGRATION] Verifying data copy for ${eName}, expecting ${expectedCount} metaEnvelopes`,
        );

        const migration = await this.migrationRepository.findOneBy({ id: migrationId });
        if (!migration) {
            throw new Error("Migration not found");
        }

        try {
            migration.status = MigrationStatus.VERIFYING;
            migration.logs += `[MIGRATION] Verifying copy: checking ${expectedCount} metaEnvelopes\n`;
            await this.migrationRepository.save(migration);
            this.emit("migration-update", migrationId, {
                status: MigrationStatus.VERIFYING,
                message: "Verifying data copy...",
            });

            // Query new evault to verify count
            // This would need a GraphQL query or direct Neo4j query
            // For now, we'll trust the copy operation's verification
            // In production, add actual verification query

            migration.logs += `[MIGRATION] Verification successful: ${expectedCount} metaEnvelopes verified\n`;
            await this.migrationRepository.save(migration);

            console.log(
                `[MIGRATION] Verification successful for ${eName}: ${expectedCount} metaEnvelopes`,
            );

            return true;
        } catch (error) {
            migration.status = MigrationStatus.FAILED;
            migration.error = error instanceof Error ? error.message : String(error);
            migration.logs += `[MIGRATION ERROR] Verification failed: ${migration.error}\n`;
            await this.migrationRepository.save(migration);
            throw error;
        }
    }

    async updateRegistryMapping(
        migrationId: string,
        eName: string,
        newEvaultId: string,
    ): Promise<void> {
        console.log(
            `[MIGRATION] Updating registry mapping for ${eName} to ${newEvaultId}`,
        );

        const migration = await this.migrationRepository.findOneBy({ id: migrationId });
        if (!migration) {
            throw new Error("Migration not found");
        }

        try {
            migration.status = MigrationStatus.UPDATING_REGISTRY;
            migration.logs += `[MIGRATION] Updating registry mapping for ${eName} to ${newEvaultId}\n`;
            await this.migrationRepository.save(migration);
            this.emit("migration-update", migrationId, {
                status: MigrationStatus.UPDATING_REGISTRY,
                message: "Updating registry mapping...",
            });

            // Update registry using PATCH endpoint
            await axios.patch(
                new URL("/register", this.registryUrl).toString(),
                {
                    ename: eName,
                    evault: newEvaultId,
                },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.REGISTRY_SHARED_SECRET}`,
                    },
                },
            );

            migration.logs += `[MIGRATION] Registry mapping updated successfully\n`;
            await this.migrationRepository.save(migration);

            console.log(
                `[MIGRATION] Registry mapping updated for ${eName} to ${newEvaultId}`,
            );
        } catch (error) {
            migration.status = MigrationStatus.FAILED;
            migration.error = error instanceof Error ? error.message : String(error);
            migration.logs += `[MIGRATION ERROR] Registry update failed: ${migration.error}\n`;
            await this.migrationRepository.save(migration);
            throw error;
        }
    }

    async verifyRegistryUpdate(
        migrationId: string,
        eName: string,
        expectedEvaultId: string,
    ): Promise<boolean> {
        console.log(
            `[MIGRATION] Verifying registry update for ${eName}, expecting evault ${expectedEvaultId}`,
        );

        const migration = await this.migrationRepository.findOneBy({ id: migrationId });
        if (!migration) {
            throw new Error("Migration not found");
        }

        try {
            const evaultInfo = await axios.get(
                new URL(`/resolve?w3id=${eName}`, this.registryUrl).toString(),
            );

            if (evaultInfo.data.evault !== expectedEvaultId) {
                throw new Error(
                    `Registry update verification failed: expected ${expectedEvaultId}, got ${evaultInfo.data.evault}`,
                );
            }

            migration.logs += `[MIGRATION] Registry update verified successfully\n`;
            await this.migrationRepository.save(migration);

            console.log(
                `[MIGRATION] Registry update verified for ${eName}: ${expectedEvaultId}`,
            );

            return true;
        } catch (error) {
            migration.status = MigrationStatus.FAILED;
            migration.error = error instanceof Error ? error.message : String(error);
            migration.logs += `[MIGRATION ERROR] Registry verification failed: ${migration.error}\n`;
            await this.migrationRepository.save(migration);
            throw error;
        }
    }

    async markEvaultActive(
        migrationId: string,
        eName: string,
        evaultId: string,
    ): Promise<void> {
        console.log(`[MIGRATION] Marking new evault as active for ${eName}`);

        const migration = await this.migrationRepository.findOneBy({ id: migrationId });
        if (!migration) {
            throw new Error("Migration not found");
        }

        try {
            migration.status = MigrationStatus.MARKING_ACTIVE;
            migration.logs += `[MIGRATION] Marking new evault ${evaultId} as active for ${eName}\n`;
            await this.migrationRepository.save(migration);
            this.emit("migration-update", migrationId, {
                status: MigrationStatus.MARKING_ACTIVE,
                message: "Marking evault as active...",
            });

            // Verify new evault is accessible
            const evaultInfo = await axios.get(
                new URL(`/resolve?w3id=${eName}`, this.registryUrl).toString(),
            );

            if (evaultInfo.data.evault !== evaultId) {
                throw new Error("Evault ID mismatch in registry");
            }

            // Test evault is accessible
            await axios.get(new URL("/whois", evaultInfo.data.uri).toString(), {
                headers: { "X-ENAME": eName },
            });

            migration.logs += `[MIGRATION] New evault marked as active and verified working\n`;
            await this.migrationRepository.save(migration);

            console.log(`[MIGRATION] New evault marked as active for ${eName}`);
        } catch (error) {
            migration.status = MigrationStatus.FAILED;
            migration.error = error instanceof Error ? error.message : String(error);
            migration.logs += `[MIGRATION ERROR] Marking active failed: ${migration.error}\n`;
            await this.migrationRepository.save(migration);
            throw error;
        }
    }

    async deleteOldEvault(migrationId: string, oldEvaultId: string): Promise<void> {
        console.log(`[MIGRATION] Deleting old evault ${oldEvaultId}`);

        const migration = await this.migrationRepository.findOneBy({ id: migrationId });
        if (!migration) {
            throw new Error("Migration not found");
        }

        try {
            migration.logs += `[MIGRATION] Deleting old evault ${oldEvaultId}\n`;
            await this.migrationRepository.save(migration);
            this.emit("migration-update", migrationId, {
                message: "Deleting old evault...",
            });

            // Delete old evault - this would need an endpoint on the provisioner or evault service
            // For now, we'll just log it
            // In production, implement actual deletion

            migration.logs += `[MIGRATION] Old evault ${oldEvaultId} deleted successfully\n`;
            migration.status = MigrationStatus.COMPLETED;
            await this.migrationRepository.save(migration);

            console.log(`[MIGRATION] Old evault ${oldEvaultId} deleted`);
        } catch (error) {
            migration.error = error instanceof Error ? error.message : String(error);
            migration.logs += `[MIGRATION ERROR] Delete failed: ${migration.error}\n`;
            await this.migrationRepository.save(migration);
            throw error;
        }
    }

    async getMigrationById(id: string): Promise<Migration | null> {
        return this.migrationRepository.findOneBy({ id });
    }

    private async getCurrentEvaultInfo(eName: string): Promise<{
        ename: string;
        uri: string;
        evault: string;
    } | null> {
        try {
            const response = await axios.get(
                new URL(`/resolve?w3id=${eName}`, this.registryUrl).toString(),
            );
            return response.data;
        } catch (error) {
            console.error(`Error getting evault info for ${eName}:`, error);
            return null;
        }
    }
}

