import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { MigrationService } from "../services/MigrationService";
import { SigningService } from "../services/SigningService";
import { EventEmitter } from "events";

export class MigrationController {
    private migrationService: MigrationService;
    private signingService: SigningService;
    private eventEmitter: EventEmitter;

    constructor() {
        this.migrationService = new MigrationService();
        this.signingService = new SigningService();
        this.eventEmitter = new EventEmitter();

        // Forward migration service events
        this.migrationService.on("migration-update", (migrationId: string, data: unknown) => {
            this.eventEmitter.emit(migrationId, data);
        });
    }

    initiate = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { provisionerUrl } = req.body;
            if (!provisionerUrl) {
                return res.status(400).json({ error: "provisionerUrl is required" });
            }

            const eName = req.user.ename;
            if (!eName) {
                return res.status(400).json({ error: "User eName not found" });
            }

            const migration = await this.migrationService.initiateMigration(
                req.user.id,
                eName,
                provisionerUrl,
            );

            return res.json({ migrationId: migration.id });
        } catch (error) {
            console.error("Error initiating migration:", error);
            return res.status(500).json({
                error:
                    error instanceof Error ? error.message : "Internal server error",
            });
        }
    };

    sign = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { migrationId } = req.body;
            if (!migrationId) {
                return res.status(400).json({ error: "migrationId is required" });
            }

            const migration = await this.migrationService.getMigrationById(migrationId);
            if (!migration) {
                return res.status(404).json({ error: "Migration not found" });
            }

            if (migration.userId !== req.user.id) {
                return res.status(403).json({ error: "Unauthorized" });
            }

            // Create signing session
            const session = await this.signingService.createSession(
                migrationId,
                {
                    migrationId,
                    eName: migration.eName,
                    newProvisionerUrl: migration.newEvaultUri || "",
                },
            );

            return res.json({
                sessionId: session.id,
                qrData: session.qrData,
            });
        } catch (error) {
            console.error("Error creating signing session:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    };

    getSessionStatus = async (req: Request, res: Response) => {
        const { id } = req.params;

        // Set headers for SSE
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*",
        });

        const handler = (data: unknown) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        this.eventEmitter.on(id, handler);

        // Handle client disconnect
        req.on("close", () => {
            this.eventEmitter.off(id, handler);
            res.end();
        });

        req.on("error", (error) => {
            console.error("SSE Error:", error);
            this.eventEmitter.off(id, handler);
            res.end();
        });
    };

    callback = async (req: Request, res: Response) => {
        try {
            const { sessionId, signature, w3id, message } = req.body;

            if (!sessionId || !signature || !w3id || !message) {
                return res.status(400).json({
                    error: "Missing required fields: sessionId, signature, w3id, message",
                });
            }

            // Verify signature and process migration
            const result = await this.signingService.processSignedPayload(
                sessionId,
                signature,
                w3id,
                message,
            );

            if (!result.success) {
                return res.status(200).json({
                    success: false,
                    error: result.error,
                });
            }

            // Start migration process
            const migrationId = result.migrationId;
            await this.processMigration(migrationId);

            return res.status(200).json({
                success: true,
                message: "Migration started",
                migrationId,
            });
        } catch (error) {
            console.error("Error processing migration callback:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    };

    getStatus = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;

            const migration = await this.migrationService.getMigrationById(id);
            if (!migration) {
                return res.status(404).json({ error: "Migration not found" });
            }

            return res.json({
                id: migration.id,
                status: migration.status,
                logs: migration.logs,
                error: migration.error,
                createdAt: migration.createdAt,
                updatedAt: migration.updatedAt,
            });
        } catch (error) {
            console.error("Error getting migration status:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    };

    deleteOld = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { migrationId } = req.body;
            if (!migrationId) {
                return res.status(400).json({ error: "migrationId is required" });
            }

            const migration = await this.migrationService.getMigrationById(migrationId);
            if (!migration) {
                return res.status(404).json({ error: "Migration not found" });
            }

            if (migration.userId !== req.user.id) {
                return res.status(403).json({ error: "Unauthorized" });
            }

            if (!migration.oldEvaultId) {
                return res.status(400).json({ error: "Old evault ID not found" });
            }

            await this.migrationService.deleteOldEvault(
                migrationId,
                migration.oldEvaultId,
            );

            return res.json({ success: true, message: "Old evault deleted" });
        } catch (error) {
            console.error("Error deleting old evault:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    };

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
            
            const { evaultId, uri: newEvaultUri } =
                await this.migrationService.provisionNewEvault(
                    migrationId,
                    migration.provisionerUrl,
                    migration.eName,
                );

            // Step 2: Copy metaEnvelopes
            const count = await this.migrationService.copyMetaEnvelopes(
                migrationId,
                migration.oldEvaultUri || "",
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
            console.error(`[MIGRATION ERROR] Migration ${migrationId} failed:`, error);
            throw error;
        }
    }
}

