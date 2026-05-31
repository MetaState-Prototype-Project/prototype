import "reflect-metadata";
import cors from "cors";
import express from "express";
import { registerSubscriptionOnStartup } from "./aaas";
import { AuthController } from "./controllers/auth";
import { DiscoverController } from "./controllers/discover";
import { fileUpload } from "./controllers/files";
import { ProfileController } from "./controllers/profile";
import { WebhookController } from "./controllers/webhook";
import { AppDataSource } from "./db";
import { env } from "./env";
import { authGuard, authMiddleware } from "./middleware/auth";
import {
    educationSchema,
    loginSchema,
    profilePatchSchema,
    skillsSchema,
    socialLinksSchema,
    validate,
    workExperienceSchema,
} from "./schemas";
import { ProfessionalProfileService } from "./services/ProfessionalProfileService";
import { UserService } from "./services/UserService";
import { adapter } from "./web3adapter/watchers/subscriber";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

AppDataSource.initialize()
    .then(async () => {
        console.log("Database connection established");

        const users = new UserService();
        const profiles = new ProfessionalProfileService();
        const auth = new AuthController(users);
        const profile = new ProfileController(users, profiles);
        const discover = new DiscoverController();
        const webhook = new WebhookController(adapter, users, profiles);

        // Inbound sync from AaaS (no auth)
        app.post("/api/webhook", webhook.handleWebhook);

        // Public auth + discovery
        app.get("/api/auth/offer", auth.getOffer);
        app.post("/api/auth", validate(loginSchema), auth.login);
        app.get("/api/auth/sessions/:id", auth.sseStream);
        app.get("/api/discover", discover.discover);

        // Auth populates req.user when a token is present
        app.use(authMiddleware);

        app.get("/api/profiles/:ename", authGuard, profile.getPublicProfile);
        app.post("/api/files", authGuard, ...fileUpload);

        app.get("/api/profile", authGuard, profile.getProfile);
        app.patch(
            "/api/profile",
            authGuard,
            validate(profilePatchSchema),
            profile.updateProfile,
        );
        app.put(
            "/api/profile/work-experience",
            authGuard,
            validate(workExperienceSchema),
            profile.updateWorkExperience,
        );
        app.put(
            "/api/profile/education",
            authGuard,
            validate(educationSchema),
            profile.updateEducation,
        );
        app.put(
            "/api/profile/skills",
            authGuard,
            validate(skillsSchema),
            profile.updateSkills,
        );
        app.put(
            "/api/profile/social-links",
            authGuard,
            validate(socialLinksSchema),
            profile.updateSocialLinks,
        );

        await registerSubscriptionOnStartup();

        app.listen(env.port, () => {
            console.log(`Profile Editor API running on port ${env.port}`);
        });
    })
    .catch((error: unknown) => {
        console.error("Database connection failed:", error);
        process.exit(1);
    });
