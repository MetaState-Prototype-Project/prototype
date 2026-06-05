import {
    createAuthGuard,
    createAuthMiddleware,
} from "@metastate-foundation/auth";
import { env } from "../env";

/**
 * Stateless JWT auth: the token's `userId` IS the eName (login signs
 * `{ userId: ename }`), so there's no session table to consult — `findUser`
 * just echoes the identity. Token expiry is enforced by the JWT itself.
 */
export const authMiddleware = createAuthMiddleware({
    secret: env.jwtSecret,
    findUser: async (userId: string) => ({ id: userId, ename: userId }),
});

export const authGuard = createAuthGuard();
