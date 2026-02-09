import type { Request, Response } from "express";
import { EventEmitter } from "node:events";
import axios from "axios";
import { MigrationService } from "../services/MigrationService";

export class AdminController {
    private migrationService: MigrationService;
    private registryUrl: string;
    private eventEmitter: EventEmitter;

    constructor() {
        this.migrationService = new MigrationService();
        this.registryUrl = process.env.PUBLIC_REGISTRY_URL || "http://localhost:4321";
        this.eventEmitter = new EventEmitter();

        // Forward migration service events
        this.migrationService.on(
            "migration-update",
            (migrationId: string, data: unknown) => {
                this.eventEmitter.emit(migrationId, data);
            },
        );
    }

    // GET /api/admin/enames - List all enames from registry
    listEnames = async (req: Request, res: Response) => {
        try {
            const response = await axios.get(`${this.registryUrl}/list`);
            const vaults = response.data;

            // Return simplified list: ename, evault, uri, provider (defensive for malformed URIs)
            const enames = vaults.map((v: { ename?: string; evault?: string; uri?: string }) => {
                let provider: string | null = null;
                if (v.uri) {
                    try {
                        provider = new URL(v.uri).hostname;
                    } catch {
                        // Malformed URI: use empty string so one bad record does not crash the request
                        provider = "";
                    }
                }
                return {
                    ename: v.ename,
                    evault: v.evault,
                    uri: v.uri,
                    provider: provider ?? "",
                };
            });

            return res.json(enames);
        } catch (error) {
            console.error("Error listing enames:", error);
            return res.status(500).json({ error: "Failed to list enames" });
        }
    };

    // POST /api/admin/migrate - Admin initiates migration for any ename (NO SIGNING)
    initiateMigration = async (req: Request, res: Response) => {
        try {
            const { ename, provisionerUrl } = req.body;

            if (!ename || !provisionerUrl) {
                return res.status(400).json({
                    error: "ename and provisionerUrl are required"
                });
            }

            // Admin initiates migration for the specified ename
            // Use admin user ID as the migration owner
            const migration = await this.migrationService.initiateMigration(
                req.user!.id, // Admin user
                ename,
                provisionerUrl,
            );

            // Admin migrations bypass signing - start immediately
            this.processMigration(migration.id).catch(error => {
                console.error(`Admin migration ${migration.id} failed:`, error);
            });

            return res.json({
                migrationId: migration.id,
                message: `Migration started for ${ename}`,
            });
        } catch (error) {
            console.error("Error initiating admin migration:", error);
            return res.status(500).json({
                error: error instanceof Error ? error.message : "Internal server error"
            });
        }
    };

    // POST /api/admin/migrate/bulk - Admin initiates migrations for multiple enames
    initiateBulkMigration = async (req: Request, res: Response) => {
        try {
            const { enames, provisionerUrl } = req.body;

            if (!enames || !Array.isArray(enames) || enames.length === 0) {
                return res.status(400).json({
                    error: "enames array is required and must not be empty"
                });
            }

            if (!provisionerUrl) {
                return res.status(400).json({
                    error: "provisionerUrl is required"
                });
            }

            const results = [];

            // Initiate migration for each ename
            for (const ename of enames) {
                try {
                    const migration = await this.migrationService.initiateMigration(
                        req.user!.id, // Admin user
                        ename,
                        provisionerUrl,
                    );

                    // Start migration immediately (no signing)
                    this.processMigration(migration.id).catch(error => {
                        console.error(`Admin bulk migration ${migration.id} for ${ename} failed:`, error);
                    });

                    results.push({
                        ename,
                        migrationId: migration.id,
                        status: 'started'
                    });
                } catch (error) {
                    results.push({
                        ename,
                        status: 'failed',
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }

            return res.json({
                results,
                message: `Started ${results.filter(r => r.status === 'started').length} of ${enames.length} migrations`,
            });
        } catch (error) {
            console.error("Error initiating bulk admin migration:", error);
            return res.status(500).json({
                error: error instanceof Error ? error.message : "Internal server error"
            });
        }
    };

    // Copy processMigration from MigrationController
    private async processMigration(migrationId: string): Promise<void> {
        const migration = await this.migrationService.getMigrationById(migrationId);
        if (!migration) {
            throw new Error("Migration not found");
        }

        try {
            // Step 1: Provision new evault
            if (!migration.provisionerUrl) {
                throw new Error("Provisioner URL not found in migration");
            }

            const { evaultId, uri: newEvaultUri, w3id: newW3id } =
                await this.migrationService.provisionNewEvault(
                    migrationId,
                    migration.provisionerUrl,
                    migration.eName,
                );

            // Step 2: Copy metaEnvelopes (validate oldEvaultUri so we fail fast)
            const oldEvaultUri = migration.oldEvaultUri;
            if (oldEvaultUri == null || oldEvaultUri.trim() === "") {
                const msg = `Migration ${migrationId} (eName: ${migration.eName ?? "unknown"}) is missing oldEvaultUri; cannot copy metaEnvelopes`;
                console.error(`[ADMIN MIGRATION ERROR] ${msg}`);
                throw new Error(msg);
            }
            const count = await this.migrationService.copyMetaEnvelopes(
                migrationId,
                oldEvaultUri,
                newEvaultUri,
                migration.eName,
            );

            // Step 3: Verify copy
            await this.migrationService.verifyDataCopy(
                migrationId,
                newEvaultUri,
                migration.eName,
                count,
            );

            // Step 4: Update registry mapping
            await this.migrationService.updateRegistryMapping(
                migrationId,
                migration.eName,
                evaultId,
                newW3id,
            );

            // Step 5: Verify registry update
            await this.migrationService.verifyRegistryUpdate(
                migrationId,
                migration.eName,
                evaultId,
            );

            // Step 6: Mark as active
            await this.migrationService.markEvaultActive(
                migrationId,
                migration.eName,
                evaultId,
            );
        } catch (error) {
            console.error(
                `[ADMIN MIGRATION ERROR] Migration ${migrationId} failed:`,
                error,
            );
            await this.migrationService.cleanupGhostEvault(migrationId);
            throw error;
        }
    }
}
