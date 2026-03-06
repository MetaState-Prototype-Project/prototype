/**
 * W3DS Gateway — Schema IDs
 *
 * Canonical ontology schema identifiers used across the W3DS ecosystem.
 * Each schema ID corresponds to a global data type defined in the Ontology service.
 * These are extracted from the mapping files found across all platforms.
 */
export const SchemaIds = {
    /** User profile */
    User: "550e8400-e29b-41d4-a716-446655440000",

    /** Social media post (tweet, photo post, comment) */
    SocialMediaPost: "550e8400-e29b-41d4-a716-446655440001",

    /** Group / chat room */
    Group: "550e8400-e29b-41d4-a716-446655440003",

    /** Chat message */
    Message: "550e8400-e29b-41d4-a716-446655440004",

    /** Voting observation / vote cast */
    VotingObservation: "550e8400-e29b-41d4-a716-446655440005",

    /** Ledger entry (financial transaction) */
    Ledger: "550e8400-e29b-41d4-a716-446655440006",

    /** Currency definition */
    Currency: "550e8400-e29b-41d4-a716-446655440008",

    /** Poll definition */
    Poll: "660e8400-e29b-41d4-a716-446655440100",

    /** Individual vote on a poll */
    Vote: "660e8400-e29b-41d4-a716-446655440101",

    /** Vote reputation results */
    VoteReputationResult: "660e8400-e29b-41d4-a716-446655440102",

    /** Wishlist */
    Wishlist: "770e8400-e29b-41d4-a716-446655440000",

    /** Charter signature */
    CharterSignature: "1d83fada-581d-49b0-b6f5-1fe0766da34f",

    /** Reference signature (reputation) */
    ReferenceSignature: "2e94fada-581d-49b0-b6f5-1fe0766da35f",

    /** File */
    File: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",

    /** Signature container (eSigner / file-manager) */
    SignatureContainer: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
} as const;

export type SchemaId = (typeof SchemaIds)[keyof typeof SchemaIds];

/** Human-readable labels for each schema type */
export const SchemaLabels: Record<SchemaId, string> = {
    [SchemaIds.User]: "User Profile",
    [SchemaIds.SocialMediaPost]: "Post",
    [SchemaIds.Group]: "Group / Chat",
    [SchemaIds.Message]: "Message",
    [SchemaIds.VotingObservation]: "Voting Observation",
    [SchemaIds.Ledger]: "Transaction",
    [SchemaIds.Currency]: "Currency",
    [SchemaIds.Poll]: "Poll",
    [SchemaIds.Vote]: "Vote",
    [SchemaIds.VoteReputationResult]: "Vote Result",
    [SchemaIds.Wishlist]: "Wishlist",
    [SchemaIds.CharterSignature]: "Charter Signature",
    [SchemaIds.ReferenceSignature]: "Reference",
    [SchemaIds.File]: "File",
    [SchemaIds.SignatureContainer]: "Signature Container",
};
