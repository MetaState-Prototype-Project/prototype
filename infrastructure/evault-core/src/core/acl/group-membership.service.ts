import type { DbService } from "../db/db.service";
import { deserializeValue } from "../db/schema";
import type { EName, GroupResolver } from "./types";

/**
 * Ontologies whose records describe a group and its participants.
 *
 * `550e8400-…-440003` is shared by Group and Chat, which is why membership is
 * read from whichever participant field a record happens to carry rather than
 * from one fixed key.
 */
export const GROUP_ONTOLOGIES = [
    "550e8400-e29b-41d4-a716-446655440003",
    "a8bfb7cf-3200-4b25-9ea9-ee41100f212e",
];

/**
 * Fields that hold participants. Different platforms mapped the same idea onto
 * different keys, and a group's members are the union of all of them.
 */
export const MEMBER_FIELDS = [
    "members",
    "memberIds",
    "participants",
    "participantIds",
    "admins",
    "owner",
];

/** The field a group record uses to name itself. */
const GROUP_ENAME_FIELD = "ename";

/** The field a profile record may use to carry its owner's eName. */
const PROFILE_ENAME_FIELD = "ename";

function isEName(value: unknown): value is EName {
    return (
        typeof value === "string" && value.startsWith("@") && value.length > 1
    );
}

/**
 * Resolves a group eName to its members' eNames.
 *
 * A participant list may name a member either by their eName or by the id of
 * their profile record — platforms mapped it both ways — so both are accepted
 * and an id is followed to the eName behind it.
 */
export class GroupMembershipService implements GroupResolver {
    constructor(private db: DbService) {}

    async membersOf(group: EName): Promise<EName[]> {
        if (!isEName(group)) return [];

        // A group record is found either by living in the group's own vault or
        // by naming the group in its `ename` field.
        const result = await this.db.runQuery(
            `
            MATCH (m:MetaEnvelope)
            WHERE m.ontology IN $ontologies
              AND (
                m.eName = $group
                OR EXISTS {
                    MATCH (m)-[:LINKS_TO]->(n:Envelope { ontology: $enameField })
                    WHERE n.value = $group
                }
              )
            MATCH (m)-[:LINKS_TO]->(e:Envelope)
            WHERE e.ontology IN $memberFields
            RETURN collect({ value: e.value, valueType: e.valueType }) AS entries
            `,
            {
                ontologies: GROUP_ONTOLOGIES,
                group,
                enameField: GROUP_ENAME_FIELD,
                memberFields: MEMBER_FIELDS,
            },
        );

        const raw: string[] = [];
        for (const record of result.records) {
            for (const entry of record.get("entries") ?? []) {
                collectEntries(entry, raw);
            }
        }
        if (raw.length === 0) return [];

        const enames = new Set<EName>();
        const ids: string[] = [];
        for (const entry of raw) {
            if (isEName(entry)) enames.add(entry);
            else ids.push(entry);
        }

        for (const resolved of await this.enamesForProfileIds(ids)) {
            enames.add(resolved);
        }
        return [...enames];
    }

    /**
     * Follows profile record ids to the eNames behind them, in one query.
     *
     * A record's own `ename` field is preferred over the vault it sits in: the
     * same profile syncs into several vaults, so the vault only identifies the
     * subject when the record does not say so itself.
     */
    private async enamesForProfileIds(ids: string[]): Promise<EName[]> {
        if (ids.length === 0) return [];

        const result = await this.db.runQuery(
            `
            MATCH (m:MetaEnvelope)
            WHERE m.id IN $ids
            OPTIONAL MATCH (m)-[:LINKS_TO]->(e:Envelope { ontology: $enameField })
            RETURN m.id AS id, m.eName AS ownerEName, e.value AS statedEName
            `,
            { ids, enameField: PROFILE_ENAME_FIELD },
        );

        const enames: EName[] = [];
        for (const record of result.records) {
            const stated = record.get("statedEName");
            const owner = record.get("ownerEName");
            if (isEName(stated)) enames.push(stated);
            else if (isEName(owner)) enames.push(owner);
        }
        return enames;
    }
}

/**
 * Participant fields hold a single value or a list, and a list of strings may
 * have been stored as a JSON blob. Everything is flattened to plain strings.
 */
function collectEntries(
    entry: { value: unknown; valueType: unknown },
    into: string[],
): void {
    const value =
        typeof entry?.valueType === "string"
            ? deserializeValue(entry.value, entry.valueType)
            : entry?.value;

    const push = (v: unknown) => {
        if (typeof v === "string" && v.length > 0) into.push(v);
    };

    if (Array.isArray(value)) value.forEach(push);
    else push(value);
}
