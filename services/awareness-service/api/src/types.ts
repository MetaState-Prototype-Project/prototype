import type { Consumer } from "./database/entities/Consumer";

/** The raw payload evault-core POSTs to /ingest (and the body delivered to subscribers). */
export interface AwarenessPayload {
    /** Stable source-generated event id. Required for new producers. */
    eventId?: string;
    id: string;
    w3id?: string | null;
    evaultPublicKey?: string | null;
    data?: Record<string, unknown> | null;
    schemaId: string;
    operation?: "create" | "update" | "delete";
    streamVersion?: number | string | null;
    occurredAt?: string;
    /**
     * The platform that triggered the change, if known. Used only to skip
     * delivering the packet back to its origin. Retained in event history for
     * audit and reconciliation, but never included in subscriber payloads.
     */
    requestingPlatform?: string | null;
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            /** Set by consumerAuth middleware once an API key is verified. */
            consumer?: Consumer;
            /** Set by portalAuth/adminAuth once a W3DS session JWT is verified. */
            ename?: string;
            isAdmin?: boolean;
        }
    }
}
