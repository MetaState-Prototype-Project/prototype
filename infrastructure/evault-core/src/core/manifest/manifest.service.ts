import { W3IDBuilder } from "w3id";
import { GroupMembershipService } from "../acl/group-membership.service";
import type { DbService } from "../db/db.service";
import type { VaultType } from "../db/types";

export const USER_PROFILE_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440000";
export const CHAT_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440003";
export const GROUP_MANIFEST_ONTOLOGY = "a8bfb7cf-3200-4b25-9ea9-ee41100f212e";
export const COMPANY_ONTOLOGY = "0f9a3cb8-4a9f-4b5f-a1fa-3a4c2eb1f402";

/** The ontology an eVault's manifest must have, by the vault's type. */
export const MANIFEST_ONTOLOGIES: Record<VaultType, string> = {
    user: USER_PROFILE_ONTOLOGY,
    group: GROUP_MANIFEST_ONTOLOGY,
    company: COMPANY_ONTOLOGY,
};

/** Platforms spelled the self-naming field both ways. */
const ENAME_FIELDS = ["ename", "eName"];

/**
 * How long a pin may point at a GroupManifest that is still being written
 * before it is treated as broken and re-resolved.
 */
const PIN_GRACE_MS = 30_000;

export type Manifest = {
    id: string;
    ontology: string;
    parsed: Record<string, unknown>;
};

export type ResolvedManifest = {
    type: VaultType | null;
    manifest: Manifest | null;
};

/**
 * Resolves the manifest of an eVault: the record that says who the vault
 * belongs to (a UserProfile, GroupManifest or Company).
 *
 * The manifest is pinned lazily, the first time it is asked for. The vault's
 * type is decided first, then the earliest record of that type's ontology
 * naming the vault itself becomes the manifest and stays pinned.
 */
export class ManifestService {
    private groups: GroupMembershipService;

    constructor(private db: DbService) {
        this.groups = new GroupMembershipService(db);
    }

    async resolve(eName: string): Promise<ResolvedManifest> {
        const config = await this.db.getVaultConfig(eName);

        if (config.manifestId) {
            const manifest = await this.load(config.manifestId, eName);
            if (manifest) return { type: config.vaultType, manifest };

            const pinnedAt = config.manifestPinnedAt ?? 0;
            if (Date.now() - pinnedAt < PIN_GRACE_MS) {
                // Another caller claimed the pin and is still writing it.
                return { type: config.vaultType, manifest: null };
            }
            await this.db.clearManifest(eName, config.manifestId);
        }

        const type = await this.inferType(eName);
        const candidate = await this.earliestSelfNaming(
            eName,
            MANIFEST_ONTOLOGIES[type],
        );

        if (!candidate) {
            if (type === "group") return this.createGroupManifest(eName);
            // Nothing to pin yet; writing the type alone would leave a node
            // behind for every eName anyone looks up.
            return { type, manifest: null };
        }

        const pinned = await this.db.pinManifest(eName, type, candidate);
        return {
            type: pinned.vaultType,
            manifest: pinned.manifestId
                ? await this.load(pinned.manifestId, eName)
                : null,
        };
    }

    /**
     * A company names itself in a Company record. A group vault is keyless and
     * holds a Chat or GroupManifest naming itself. Anything else is a user,
     * keyed or not.
     */
    async inferType(eName: string): Promise<VaultType> {
        const result = await this.db.runQuery(
            `
            OPTIONAL MATCH (u:User { eName: $eName })
            WITH coalesce(size(u.publicKeys), 0) = 0 AS keyless
            RETURN keyless,
                EXISTS {
                    MATCH (m:MetaEnvelope { eName: $eName, ontology: $company })-[:LINKS_TO]->(n:Envelope)
                    WHERE n.ontology IN $enameFields AND n.value = $eName
                } AS isCompany,
                EXISTS {
                    MATCH (m:MetaEnvelope { eName: $eName })-[:LINKS_TO]->(n:Envelope)
                    WHERE m.ontology IN $groupOntologies
                      AND n.ontology IN $enameFields AND n.value = $eName
                } AS hasGroupRecord
            `,
            {
                eName,
                company: COMPANY_ONTOLOGY,
                groupOntologies: [CHAT_ONTOLOGY, GROUP_MANIFEST_ONTOLOGY],
                enameFields: ENAME_FIELDS,
            },
        );

        const record = result.records[0];
        if (record.get("isCompany")) return "company";
        if (record.get("keyless") && record.get("hasGroupRecord")) {
            return "group";
        }
        return "user";
    }

    /**
     * The earliest record of an ontology in the vault that names the vault.
     *
     * Records written before version history existed have no history node and
     * are older than any that do, so they sort first; within each group the
     * record's own `createdAt` and then its history timestamp break ties.
     */
    private async earliestSelfNaming(
        eName: string,
        ontology: string,
    ): Promise<string | null> {
        const result = await this.db.runQuery(
            `
            MATCH (m:MetaEnvelope { eName: $eName, ontology: $ontology })
            WHERE EXISTS {
                MATCH (m)-[:LINKS_TO]->(n:Envelope)
                WHERE n.ontology IN $enameFields AND n.value = $eName
            }
            OPTIONAL MATCH (h:MetaEnvelopeHistory { metaEnvelopeId: m.id, eName: $eName })
            OPTIONAL MATCH (m)-[:LINKS_TO]->(c:Envelope { ontology: "createdAt" })
            RETURN m.id AS id
            ORDER BY h IS NOT NULL, c.value, h.createdAt, m.id
            LIMIT 1
            `,
            { eName, ontology, enameFields: ENAME_FIELDS },
        );
        return result.records[0]?.get("id") ?? null;
    }

    /**
     * Older group vaults only hold a Chat. A GroupManifest is built from it
     * once: the pin is claimed with a fresh id first, so concurrent callers
     * cannot both write one, and only the winner stores the record.
     */
    private async createGroupManifest(
        eName: string,
    ): Promise<ResolvedManifest> {
        const id = (await new W3IDBuilder().build()).id;
        const pinned = await this.db.pinManifest(eName, "group", id);
        if (!pinned.won) {
            return {
                type: pinned.vaultType,
                manifest: pinned.manifestId
                    ? await this.load(pinned.manifestId, eName)
                    : null,
            };
        }

        try {
            const payload = await this.groupManifestFromChat(eName);
            await this.db.storeMetaEnvelopeWithId(
                { ontology: GROUP_MANIFEST_ONTOLOGY, payload, acl: ["*"] },
                ["*"],
                eName,
                id,
            );
        } catch (error) {
            await this.db.clearManifest(eName, id);
            throw error;
        }
        return { type: "group", manifest: await this.load(id, eName) };
    }

    private async groupManifestFromChat(
        eName: string,
    ): Promise<Record<string, unknown>> {
        const chatId = await this.earliestSelfNaming(eName, CHAT_ONTOLOGY);
        const chat = chatId ? await this.load(chatId, eName) : null;
        const fields = chat?.parsed ?? {};

        const admins = Array.isArray(fields.admins)
            ? fields.admins.filter((a): a is string => typeof a === "string")
            : [];
        const owner = typeof fields.owner === "string" ? fields.owner : eName;
        const now = new Date().toISOString();

        const manifest: Record<string, unknown> = {
            eName,
            name: typeof fields.name === "string" ? fields.name : eName,
            members: await this.groups.membersOf(eName),
            admins,
            owner,
            createdAt: now,
            updatedAt: now,
        };
        for (const key of ["description", "avatar", "charter"]) {
            if (typeof fields[key] === "string") manifest[key] = fields[key];
        }
        return manifest;
    }

    private async load(id: string, eName: string): Promise<Manifest | null> {
        const found = await this.db.findMetaEnvelopeById(id, eName);
        if (!found) return null;
        return { id: found.id, ontology: found.ontology, parsed: found.parsed };
    }
}
