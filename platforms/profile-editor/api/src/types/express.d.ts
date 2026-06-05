import type { AuthUser } from "@metastate-foundation/auth";

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}
