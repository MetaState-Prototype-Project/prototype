import { YogaInitialContext } from "graphql-yoga";
import { DbService } from "../db/db.service";
import { MetaEnvelope } from "../db/types";
import * as jose from "jose";
import axios from "axios";

export type VaultContext = YogaInitialContext & {
    currentUser: string | null;
    tokenPayload?: any;
    eName: string | null;
};

export class VaultAccessGuard {
    constructor(private db: DbService) {}

    /**
     * Validates JWT token from Authorization header
     * @param authHeader - The Authorization header value
     * @returns Promise<any> - The validated token payload
     */
    private async validateToken(
        authHeader: string | null
    ): Promise<any | null> {
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return null;
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        try {
            const registryUrl = process.env.PUBLIC_REGISTRY_URL || process.env.REGISTRY_URL;
            if (!registryUrl) {
                console.error("PUBLIC_REGISTRY_URL or REGISTRY_URL is not set");
                return null;
            }

            const jwksResponse = await axios.get(
                new URL(
                    `/.well-known/jwks.json`,
                    registryUrl
                ).toString()
            );

            const JWKS = jose.createLocalJWKSet(jwksResponse.data);
            const { payload } = await jose.jwtVerify(token, JWKS);

            return payload;
        } catch (error) {
            console.error("Token validation failed:", error);
            return null;
        }
    }

    /**
     * Validates authentication before allowing access to any operation
     * REQUIRES a valid Bearer token - X-ENAME alone is NOT sufficient for authentication
     * Exception: storeMetaEnvelope only requires X-ENAME (no Bearer token needed)
     * @param context - The GraphQL context containing headers and user info
     * @param isStoreOperation - If true, only requires X-ENAME (for storeMetaEnvelope)
     * @throws Error if authentication fails
     */
    private async validateAuthentication(context: VaultContext, isStoreOperation: boolean = false): Promise<void> {
        // Special case: storeMetaEnvelope only requires X-ENAME, no Bearer token
        if (isStoreOperation) {
            if (!context.eName) {
                throw new Error("X-ENAME header is required for storeMetaEnvelope");
            }
            if (typeof context.eName !== "string" || context.eName.trim().length === 0) {
                throw new Error("Invalid X-ENAME header: eName must be a non-empty string");
            }
            // Try to validate token if present (optional for store operations)
            const authHeader =
                context.request?.headers?.get("authorization") ??
                context.request?.headers?.get("Authorization");
            const tokenPayload = await this.validateToken(authHeader);
            if (tokenPayload) {
                context.tokenPayload = tokenPayload;
            }
            return;
        }

        // For all other operations: Bearer token is REQUIRED
        const authHeader =
            context.request?.headers?.get("authorization") ??
            context.request?.headers?.get("Authorization");

        // Validate JWT token - this is REQUIRED
        const tokenPayload = await this.validateToken(authHeader);

        if (!tokenPayload) {
            throw new Error("Authentication required: A valid Bearer token in Authorization header is required");
        }

        // Valid token found - set token payload
        context.tokenPayload = tokenPayload;
    }

    /**
     * Checks if the current user has access to a meta envelope based on its ACL
     * @param metaEnvelopeId - The ID of the meta envelope to check access for
     * @param context - The GraphQL context containing the current user
     * @returns Promise<{hasAccess: boolean, exists: boolean}> - Whether the user has access and if envelope exists
     */
    private async checkAccess(
        metaEnvelopeId: string,
        context: VaultContext
    ): Promise<{ hasAccess: boolean; exists: boolean }> {
        // Validate token if present
        const authHeader =
            context.request?.headers?.get("authorization") ??
            context.request?.headers?.get("Authorization");
        const tokenPayload = await this.validateToken(authHeader);

        if (tokenPayload) {
            // Token is valid, set platform context and allow access
            context.tokenPayload = tokenPayload;
            // Still need to check if envelope exists
            if (!context.eName) {
                return { hasAccess: true, exists: false };
            }
            const metaEnvelope = await this.db.findMetaEnvelopeById(metaEnvelopeId, context.eName);
            return { hasAccess: true, exists: metaEnvelope !== null };
        }

        // Validate eName is present
        if (!context.eName) {
            throw new Error("X-ENAME header is required for access control");
        }

        const metaEnvelope = await this.db.findMetaEnvelopeById(metaEnvelopeId, context.eName);
        if (!metaEnvelope) {
            return { hasAccess: false, exists: false };
        }

        // Fallback to original ACL logic if no valid token
        if (!context.currentUser) {
            if (metaEnvelope.acl.includes("*")) {
                return { hasAccess: true, exists: true };
            }
            return { hasAccess: false, exists: true };
        }

        // If ACL contains "*", anyone can access
        if (metaEnvelope.acl.includes("*")) {
            return { hasAccess: true, exists: true };
        }

        // Check if the current user's ID is in the ACL
        const hasAccess = metaEnvelope.acl.includes(context.currentUser);
        return { hasAccess, exists: true };
    }

    /**
     * Filters out ACL from meta envelope responses
     * @param metaEnvelope - The meta envelope to filter
     * @returns The filtered meta envelope without ACL
     */
    private filterACL(metaEnvelope: any) {
        if (!metaEnvelope) return null;
        // Return primitives (boolean, string, number) as-is - don't try to destructure
        if (typeof metaEnvelope !== 'object') {
            return metaEnvelope;
        }
        const { acl, ...filtered } = metaEnvelope;
        return filtered;
    }

    /**
     * Filters a list of meta envelopes to only include those the user has access to
     * @param envelopes - List of meta envelopes to filter
     * @param context - The GraphQL context containing the current user
     * @returns Promise<Array> - Filtered list of meta envelopes
     */
    private async filterEnvelopesByAccess(
        envelopes: MetaEnvelope[],
        context: VaultContext
    ): Promise<any[]> {
        const filteredEnvelopes = [];
        for (const envelope of envelopes) {
            const hasAccess =
                envelope.acl.includes("*") ||
                envelope.acl.includes(context.currentUser ?? "");
            if (hasAccess) {
                filteredEnvelopes.push(this.filterACL(envelope));
            }
        }
        return filteredEnvelopes;
    }

    /**
     * Middleware function to check access before executing a resolver
     * @param resolver - The resolver function to wrap
     * @returns A wrapped resolver that checks access before executing
     */
    public middleware<T, Args extends { [key: string]: any }>(
        resolver: (parent: T, args: Args, context: VaultContext) => Promise<any>
    ) {
        return async (parent: T, args: Args, context: VaultContext) => {
            // Check if this is storeMetaEnvelope operation (has input with ontology, payload, acl)
            const isStoreOperation = args.input &&
                typeof args.input === 'object' &&
                'ontology' in args.input &&
                'payload' in args.input &&
                'acl' in args.input &&
                !args.id; // storeMetaEnvelope doesn't have id, updateMetaEnvelopeById does

            // CRITICAL: Validate authentication BEFORE executing any resolver
            await this.validateAuthentication(context, isStoreOperation);

            // For operations that don't require a specific meta envelope ID (bulk queries)
            if (!args.id && !args.envelopeId) {
                // Authentication validated, now execute resolver
                const result = await resolver(parent, args, context);

                // If the result is an array
                if (Array.isArray(result)) {
                    // Check if it's an array of Envelopes (no ACL) or MetaEnvelopes (has ACL)
                    if (result.length > 0 && result[0] && !('acl' in result[0])) {
                        // It's an array of Envelopes - already filtered by eName, just return as-is
                        return result;
                    }
                    // It's an array of MetaEnvelopes - filter based on access
                    return this.filterEnvelopesByAccess(result, context);
                }

                // If the result is a single meta envelope, filter ACL
                return this.filterACL(result);
            }

            // For operations that target a specific meta envelope
            const metaEnvelopeId = args.id || args.envelopeId;
            if (!metaEnvelopeId) {
                // Authentication validated, now execute resolver
                const result = await resolver(parent, args, context);
                return this.filterACL(result);
            }

            // Check if envelope exists and user has access
            const { hasAccess, exists } = await this.checkAccess(metaEnvelopeId, context);

            // For update operations with input, allow in-place creation if envelope doesn't exist
            if (!exists && args.input) {
                // Envelope doesn't exist for this eName - allow in-place creation
                const result = await resolver(parent, args, context);
                return this.filterACL(result);
            }

            if (!hasAccess) {
                // If envelope doesn't exist, return null (not found)
                if (!exists) {
                    return null;
                }
                // Envelope exists but access denied
                throw new Error("Access denied");
            }

            // Execute resolver and filter ACL
            const result = await resolver(parent, args, context);

            // If result is null (envelope not found), return null
            if (result === null) {
                return null;
            }

            return this.filterACL(result);
        };
    }
}
