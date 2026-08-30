import { createHash } from "node:crypto";
import type { Repository } from "typeorm";
import type { PlatformManagement } from "../entities/PlatformManagement";
import { generateManagedPlatformToken, verifyPlatformTokenClaims } from "../jwt";

export const PLATFORM_PROFILE_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440000";

export class PlatformManagementConflictError extends Error {}

export function tokenFingerprint(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex");
}

export class PlatformManagementService {
    constructor(private readonly repository: Repository<PlatformManagement>) {}

    async inspectLegacyToken(token: string): Promise<{ platform: string; fingerprint: string }> {
        const claims = await verifyPlatformTokenClaims(token);
        if (!claims || claims.kind === "platform-manager") {
            throw new Error("A valid legacy platform token is required");
        }
        return { platform: claims.platform, fingerprint: tokenFingerprint(token) };
    }

    async find(ename: string): Promise<PlatformManagement | null> {
        return this.repository.findOneBy({ ename });
    }

    async transfer(input: {
        ename: string;
        manager: string;
        profileEnvelopeId: string;
        legacyToken: string;
    }): Promise<{ management: PlatformManagement; token: string }> {
        const inspected = await this.inspectLegacyToken(input.legacyToken);
        const existing = await this.find(input.ename);
        const fingerprint = inspected.fingerprint;
        if (existing) {
            if (
                existing.manager !== input.manager ||
                existing.profileEnvelopeId !== input.profileEnvelopeId ||
                existing.revokedTokenFingerprint !== fingerprint
            ) {
                throw new PlatformManagementConflictError("This platform is already managed by another migration");
            }
            return { management: existing, token: await generateManagedPlatformToken(input.ename, input.manager) };
        }

        const management = await this.repository.save(
            this.repository.create({
                ename: input.ename,
                manager: input.manager,
                profileEnvelopeId: input.profileEnvelopeId,
                revokedTokenFingerprint: fingerprint,
            }),
        );
        return { management, token: await generateManagedPlatformToken(input.ename, input.manager) };
    }

    async managerToken(ename: string, manager: string): Promise<string> {
        const management = await this.find(ename);
        if (!management || management.manager !== manager) {
            throw new Error("The requested manager does not control this platform");
        }
        return generateManagedPlatformToken(ename, manager);
    }

    async authorizeProfileWrite(input: {
        ename: string;
        ontology: string;
        envelopeId?: string;
        token?: string;
    }): Promise<{ managed: boolean; allowed: boolean; reason?: string }> {
        if (input.ontology !== PLATFORM_PROFILE_ONTOLOGY) {
            return { managed: false, allowed: true };
        }
        const management = await this.find(input.ename);
        if (!management) return { managed: false, allowed: true };
        if (input.envelopeId && input.envelopeId !== management.profileEnvelopeId) {
            return { managed: true, allowed: false, reason: "The managed platform profile has a different envelope ID" };
        }
        if (!input.token) {
            return { managed: true, allowed: false, reason: "A platform manager token is required" };
        }
        if (tokenFingerprint(input.token) === management.revokedTokenFingerprint) {
            return { managed: true, allowed: false, reason: "The legacy platform token was revoked during migration" };
        }
        const claims = await verifyPlatformTokenClaims(input.token);
        const allowed = !!claims && claims.kind === "platform-manager" && claims.managedEname === input.ename && claims.manager === management.manager;
        return { managed: true, allowed, ...(!allowed && { reason: "The token is not the active platform manager" }) };
    }
}
