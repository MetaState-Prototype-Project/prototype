export const web3AdapterConfig = {
    // Registry URL for resolving ename to eVault URLs
    registryUrl: process.env.REGISTRY_URL || "http://localhost:4000",
    
    // Webhook configuration
    webhook: {
        // The URL where this adapter will receive updates from other platforms
        receiveUrl: process.env.WEB3_ADAPTER_WEBHOOK_URL || "http://localhost:4444/web3adapter/webhook",
        // Secret for webhook signature verification
        secret: process.env.WEB3_ADAPTER_WEBHOOK_SECRET || "your-webhook-secret"
    },

    // eVault configuration
    eVault: {
        // GraphQL endpoint for eVault operations
        graphqlUrl: process.env.EVAULT_GRAPHQL_URL || "http://localhost:4000/graphql",
        // Default ACL for stored envelopes
        defaultAcl: process.env.EVAULT_DEFAULT_ACL ? 
            process.env.EVAULT_DEFAULT_ACL.split(",") : 
            ["@d1fa5cb1-6178-534b-a096-59794d485f65"]
    },

    // Entity type mappings to global ontology
    entityMappings: {
        User: "UserProfile",
        Post: "SocialMediaPost",
        Comment: "SocialMediaPost",
        Chat: "Chat",
        Message: "Message",
        MessageReadStatus: "MessageReadStatus"
    }
} as const; 