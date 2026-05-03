import type { Consumer } from "./database/entities/Consumer";

/** The raw payload evault-core POSTs to /ingest (and the body delivered to subscribers). */
export interface AwarenessPayload {
    id: string;
    w3id?: string | null;
    evaultPublicKey?: string | null;
    data?: Record<string, unknown> | null;
    schemaId: string;
    operation?: "create" | "update" | "delete";
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
