/**
 * Ontology → platform mapping for **retroactive backfill only**.
 * New logs get platform from the request token only; this is not used by resolvers.
 */

const ONTOLOGY_TO_PLATFORM: Record<string, string> = {
    // User profile, messages, groups, post, comment, chat (social) → blabsy
    "550e8400-e29b-41d4-a716-446655440000": "blabsy",
    "550e8400-e29b-41d4-a716-446655440003": "blabsy",
    "550e8400-e29b-41d4-a716-446655440004": "blabsy",
    "550e8400-e29b-41d4-a716-446655440001": "blabsy",
    // Ledger / currency → eCurrency
    "550e8400-e29b-41d4-a716-446655440006": "eCurrency",
    "550e8400-e29b-41d4-a716-446655440008": "eCurrency",
    // Poll, vote, vote-reputation → eVoting / eReputation
    "660e8400-e29b-41d4-a716-446655440100": "eVoting",
    "660e8400-e29b-41d4-a716-446655440101": "eVoting",
    "660e8400-e29b-41d4-a716-446655440102": "eReputation",
    "550e8400-e29b-41d4-a716-446655440005": "eReputation",
    // Wishlist → eReputation / DreamSync
    "770e8400-e29b-41d4-a716-446655440000": "eReputation",
    // Signatures, charters, files
    "b2c3d4e5-f6a7-8901-bcde-f12345678901": "esigner",
    "1d83fada-581d-49b0-b6f5-1fe0766da34f": "group-charter-manager",
    "2e94fada-581d-49b0-b6f5-1fe0766da35f": "eReputation",
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890": "file-manager",
};

/**
 * Infers platform from ontology for **backfill only**. Returns "unknown" for unmapped ontologies.
 */
export function inferPlatformFromOntology(ontology: string): string {
    const normalized = ontology.trim().toLowerCase();
    const byExact = ONTOLOGY_TO_PLATFORM[ontology];
    if (byExact) return byExact;
    const byNormalized = Object.entries(ONTOLOGY_TO_PLATFORM).find(
        ([k]) => k.trim().toLowerCase() === normalized,
    );
    if (byNormalized) return byNormalized[1];
    return "unknown";
}
