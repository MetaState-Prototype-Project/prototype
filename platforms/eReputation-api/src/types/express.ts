import { User } from "../database/entities/User";

declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}

// Export empty object to make this a module
export {};
