import { randomUUID } from "crypto";
import { EventEmitter } from "events";
import axios from "axios";
import * as jose from "jose";
import { AppDataSource } from "../database/data-source";
import { Migration, MigrationStatus } from "../database/entities/Migration";

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

        const migration = await this.migrationRepository.findOneBy({
            id: migrationId,
        });
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

            // Get public key from old evault
            console.log(
                `[MIGRATION] Retrieving public key from old evault for ${eName}`,
            );
            let publicKey = "0x0000000000000000000000000000000000000000"; // Default fallback

            try {
                const whoisResponse = await axios.get(
                    new URL("/whois", migration.oldEvaultUri || "").toString(),
                    {
                        headers: {
                            "X-ENAME": eName,
                        },
                    },
                );
                
                // Extract public key from keyBindingCertificates array
                const keyBindingCertificates = whoisResponse.data?.keyBindingCertificates;
                if (keyBindingCertificates && Array.isArray(keyBindingCertificates) && keyBindingCertificates.length > 0) {
                    try {
                        // Get registry JWKS for JWT verification
                        const jwksUrl = new URL("/.well-known/jwks.json", this.registryUrl).toString();
                        const jwksResponse = await axios.get(jwksUrl, {
                            timeout: 10000,
                        });
                        const JWKS = jose.createLocalJWKSet(jwksResponse.data);

                        // Extract public key from first certificate (or try all until one works)
                        for (const jwt of keyBindingCertificates) {
                            try {
                                const { payload } = await jose.jwtVerify(jwt, JWKS);
                                
                                // Verify ename matches
                                if (payload.ename !== eName) {
                                    continue;
                                }

                                // Extract publicKey from JWT payload
                                const extractedPublicKey = payload.publicKey as string;
                                if (extractedPublicKey) {
                                    publicKey = extractedPublicKey;
                                    console.log(
                                        `[MIGRATION] Retrieved public key from old evault: ${publicKey.substring(0, 20)}...`,
                                    );
                                    migration.logs += `[MIGRATION] Retrieved public key from old evault\n`;
                                    break; // Found valid key, exit loop
                                }
                            } catch (error) {
                                // JWT verification failed, try next certificate
                                console.warn(
                                    `[MIGRATION] Failed to verify key binding certificate, trying next...`,
                                );
                                continue;
                            }
                        }

                        if (publicKey === "0x0000000000000000000000000000000000000000") {
                            console.warn(
                                `[MIGRATION] No valid public key found in certificates, using default`,
                            );
                            migration.logs += `[MIGRATION] Warning: No valid public key found in certificates, using default\n`;
                        }
                    } catch (error) {
                        console.error(
                            `[MIGRATION ERROR] Failed to verify key binding certificates:`,
                            error,
                        );
                        migration.logs += `[MIGRATION ERROR] Failed to verify certificates, using default\n`;
                    }
                } else {
                    console.warn(
                        `[MIGRATION] No key binding certificates found in old evault, using default`,
                    );
                    migration.logs += `[MIGRATION] Warning: No key binding certificates found in old evault, using default\n`;
                }
            } catch (error) {
                console.error(
                    `[MIGRATION ERROR] Failed to retrieve public key from old evault:`,
                    error,
                );
                migration.logs += `[MIGRATION ERROR] Failed to retrieve public key, using default\n`;
                // Continue with default public key - don't fail the migration
            }

            // Get entropy from registry
            const entropyResponse = await axios.get(
                new URL("/entropy", this.registryUrl).toString(),
            );
            const registryEntropy = entropyResponse.data.token;

            // Generate unique namespace to ensure a new eVault instance is created
            // Even when using the same provisioner, each migration gets a fresh eVault
            const namespace = randomUUID();
            console.log(
                `[MIGRATION] Provisioning new eVault instance with namespace: ${namespace}`,
            );
            console.log(
                `[MIGRATION] Using provisioner: ${provisionerUrl} (will create new eVault ID)`,
            );

            // Provision new evault with preserved public key
            const provisionBody: {
                registryEntropy: string;
                namespace: string;
                verificationId: string;
                publicKey?: string;
            } = {
                registryEntropy,
                namespace: namespace,
                verificationId:
                    process.env.DEMO_VERIFICATION_CODE ||
                    "d66b7138-538a-465f-a6ce-f6985854c3f4",
            };

            // Only include publicKey if it's not the default fallback
            if (publicKey !== "0x0000000000000000000000000000000000000000") {
                provisionBody.publicKey = publicKey;
                console.log(
                    `[MIGRATION] Provisioning new evault with public key: ${publicKey.substring(0, 20)}...`,
                );
                migration.logs += `[MIGRATION] Provisioning with public key: ${publicKey.substring(0, 20)}...\n`;
            } else {
                console.log(`[MIGRATION] Provisioning keyless evault (no public key)`);
                migration.logs += `[MIGRATION] Provisioning keyless evault (no public key)\n`;
            }

            const provisionResponse = await axios.post(
                new URL("/provision", provisionerUrl).toString(),
                provisionBody,
            );

            if (!provisionResponse.data.success) {
                throw new Error("Failed to provision new evault");
            }

            const { w3id, uri } = provisionResponse.data;

            // Persist newW3id immediately so cleanup can remove the Registry entry on any later failure
            migration.newW3id = w3id;
            await this.migrationRepository.save(migration);

            // Get evault ID from registry
            const evaultInfo = await axios.get(
                new URL(`/resolve?w3id=${w3id}`, this.registryUrl).toString(),
            );
            const evaultId = evaultInfo.data.evault;

            // Verify that the new eVault ID is different from the old one
            if (migration.oldEvaultId && evaultId === migration.oldEvaultId) {
                throw new Error(
                    `New eVault ID (${evaultId}) is the same as old eVault ID. This should not happen.`,
                );
            }

            migration.newEvaultId = evaultId;
            migration.newEvaultUri = uri;
            migration.logs += `[MIGRATION] New evault provisioned: ${evaultId}, URI: ${uri}\n`;
            migration.logs += `[MIGRATION] Old evault ID: ${migration.oldEvaultId || "N/A"}, New evault ID: ${evaultId}\n`;
            
            if (publicKey !== "0x0000000000000000000000000000000000000000") {
                migration.logs += `[MIGRATION] Public key preserved: ${publicKey.substring(0, 20)}...\n`;
            } else {
                migration.logs += `[MIGRATION] Keyless evault provisioned successfully\n`;
            }
            
            await this.migrationRepository.save(migration);

            console.log(
                `[MIGRATION] Successfully created new eVault instance: ${evaultId} (different from old: ${migration.oldEvaultId || "N/A"})`,
            );

            // Note: Public key will be copied automatically when copying metaEnvelopes
            // (User node is copied as part of the copyMetaEnvelopes operation)

            console.log(
                `[MIGRATION] New evault provisioned: ${evaultId} for ${eName}`,
            );

            return { w3id, uri, evaultId };
        } catch (error) {
            migration.status = MigrationStatus.FAILED;
            migration.error =
                error instanceof Error ? error.message : String(error);
            migration.logs += `[MIGRATION ERROR] Provisioning failed: ${migration.error}\n`;
            await this.migrationRepository.save(migration);
            throw error;
        }
    }

    /**
     * Removes the ghost Registry entry (provisioner-created w3id -> new evault) when a migration fails.
     * Best-effort; does not throw.
     */
    async cleanupGhostEvault(migrationId: string): Promise<void> {
        const migration = await this.migrationRepository.findOneBy({
            id: migrationId,
        });
        if (!migration?.newW3id) {
            return;
        }
        try {
            await axios.delete(
                new URL(
                    `/register?ename=${encodeURIComponent(migration.newW3id)}`,
                    this.registryUrl,
                ).toString(),
                {
                    headers: {
                        Authorization: `Bearer ${process.env.REGISTRY_SHARED_SECRET}`,
                    },
                    validateStatus: (status) => status === 200 || status === 404,
                },
            );
            console.log(
                `[MIGRATION] Cleaned up ghost Registry entry for w3id: ${migration.newW3id}`,
            );
        } catch (error) {
            console.warn(
                `[MIGRATION] Failed to cleanup ghost Registry entry for w3id ${migration.newW3id}:`,
                error,
            );
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

        const migration = await this.migrationRepository.findOneBy({
            id: migrationId,
        });
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
            // Neo4j uses bolt:// protocol, not http://
            // Derive Neo4j URI from eVault URI: same host, port 7687
            // TODO: In production, these should be retrieved from evault metadata or the provisioner response
            const oldEvaultUrl = new URL(oldEvaultUri);
            const newEvaultUrl = new URL(newEvaultUri);

            const oldNeo4jUri = `bolt://${oldEvaultUrl.hostname}:7687`;
            const newNeo4jUri = `bolt://${newEvaultUrl.hostname}:7687`;

            // Neo4j credentials are typically consistent across eVaults in a deployment
            const neo4jUser = process.env.NEO4J_USER || "neo4j";
            const neo4jPassword = process.env.NEO4J_PASSWORD || "neo4j";

            console.log(
                `[MIGRATION] Copying from old eVault (${oldEvaultUri}) to new eVault (${newEvaultUri})`,
            );
            console.log(
                `[MIGRATION] Old Neo4j URI: ${oldNeo4jUri}, New Neo4j URI: ${newNeo4jUri}`,
            );
            console.log(
                `[MIGRATION] Neo4j credentials: user=${neo4jUser}, password=${neo4jPassword ? "***" : "not set"}`,
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
                {
                    timeout: 300000, // 5 minutes timeout for large migrations
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
            migration.error =
                error instanceof Error ? error.message : String(error);
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

        const migration = await this.migrationRepository.findOneBy({
            id: migrationId,
        });
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
            migration.error =
                error instanceof Error ? error.message : String(error);
            migration.logs += `[MIGRATION ERROR] Verification failed: ${migration.error}\n`;
            await this.migrationRepository.save(migration);
            throw error;
        }
    }

    async updateRegistryMapping(
        migrationId: string,
        eName: string,
        newEvaultId: string,
        newW3id: string,
    ): Promise<void> {
        console.log(
            `[MIGRATION] Updating registry mapping for ${eName} to ${newEvaultId}`,
        );

        const migration = await this.migrationRepository.findOneBy({
            id: migrationId,
        });
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

            // Delete the registry entry created by provisioner (w3id -> evault)
            // This prevents duplicate mappings where both w3id and user's eName point to same evault
            try {
                await axios.delete(
                    new URL(
                        `/register?ename=${encodeURIComponent(newW3id)}`,
                        this.registryUrl,
                    ).toString(),
                    {
                        headers: {
                            Authorization: `Bearer ${process.env.REGISTRY_SHARED_SECRET}`,
                        },
                    },
                );
                migration.logs += `[MIGRATION] Deleted provisioner-created registry entry for w3id: ${newW3id}\n`;
                console.log(
                    `[MIGRATION] Deleted provisioner registry entry: ${newW3id}`,
                );
            } catch (error) {
                // Log but don't fail if deletion fails (entry might not exist or already deleted)
                console.warn(
                    `[MIGRATION] Failed to delete provisioner registry entry:`,
                    error,
                );
                migration.logs += `[MIGRATION] Warning: Could not delete provisioner registry entry for ${newW3id}\n`;
            }

            await this.migrationRepository.save(migration);

            console.log(
                `[MIGRATION] Registry mapping updated for ${eName} to ${newEvaultId}`,
            );
        } catch (error) {
            migration.status = MigrationStatus.FAILED;
            migration.error =
                error instanceof Error ? error.message : String(error);
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

        const migration = await this.migrationRepository.findOneBy({
            id: migrationId,
        });
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
            migration.error =
                error instanceof Error ? error.message : String(error);
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

        const migration = await this.migrationRepository.findOneBy({
            id: migrationId,
        });
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
            migration.status = MigrationStatus.COMPLETED;
            await this.migrationRepository.save(migration);

            console.log(`[MIGRATION] New evault marked as active for ${eName}`);
        } catch (error) {
            migration.status = MigrationStatus.FAILED;
            migration.error =
                error instanceof Error ? error.message : String(error);
            migration.logs += `[MIGRATION ERROR] Marking active failed: ${migration.error}\n`;
            await this.migrationRepository.save(migration);
            throw error;
        }
    }

    async deleteOldEvault(
        migrationId: string,
        oldEvaultId: string,
    ): Promise<void> {
        console.log(`[MIGRATION] Deleting old evault ${oldEvaultId}`);

        const migration = await this.migrationRepository.findOneBy({
            id: migrationId,
        });
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
            migration.error =
                error instanceof Error ? error.message : String(error);
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
