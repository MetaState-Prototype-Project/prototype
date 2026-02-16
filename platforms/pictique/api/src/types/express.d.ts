import { User } from "../database/entities/User";

declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
} 