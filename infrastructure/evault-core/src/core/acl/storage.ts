import { normalizeAclBlock } from "./acl";
import type { AclBlock } from "./types";

/**
 * Neo4j properties hold only primitives and arrays of primitives, so the `_acl`
 * block is persisted as a JSON string on the `:MetaEnvelope` node. The legacy
 * `acl` array stays alongside it untouched, so a record written before this
 * change keeps behaving as it did.
 */
export function serializeAclBlock(
    block: AclBlock | null | undefined,
): string | null {
    if (!block) return null;
    return JSON.stringify(normalizeAclBlock(block));
}

/**
 * Reads a stored block back. Returns `undefined` — not an empty policy — when
 * nothing is stored, so callers can tell "no block, fall back to the legacy
 * array" apart from "an explicit block that grants nothing".
 */
export function parseStoredAclBlock(raw: unknown): AclBlock | undefined {
    if (raw === null || raw === undefined) return undefined;
    if (typeof raw === "object") return normalizeAclBlock(raw);
    if (typeof raw !== "string" || raw.length === 0) return undefined;
    try {
        return normalizeAclBlock(JSON.parse(raw));
    } catch {
        // A corrupt block must not fall back to a permissive legacy array.
        return normalizeAclBlock(null);
    }
}
