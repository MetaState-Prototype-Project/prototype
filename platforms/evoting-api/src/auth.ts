import { betterAuth } from "better-auth";
import { AppDataSource } from "./database/data-source";
import { typeormAdapter } from "./utils/typeorm-adapter";

export const auth = betterAuth({
    database: typeormAdapter(AppDataSource),
    emailAndPassword: {
        enabled: true,
    },
    trustedOrigins: [process.env.EVOTING_CLIENT_URL || "http://localhost:3000"],
});
