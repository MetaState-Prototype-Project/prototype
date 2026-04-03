import "reflect-metadata";
import express from "express";
import cors from "cors";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(__dirname, "../../../../.env") });

import { AppDataSource } from "./database/data-source";
import { AuthController } from "./controllers/AuthController";
import { ProfileController } from "./controllers/ProfileController";
import { DiscoveryController } from "./controllers/DiscoveryController";
import { WebhookController } from "./controllers/WebhookController";
import { EVaultProfileService } from "./services/EVaultProfileService";
import { RegistryService } from "./services/RegistryService";
import { authMiddleware, authGuard } from "./middleware/auth";
import { fileProxyUpload } from "./controllers/FileProxyController";
import { EVaultSyncService } from "./services/EVaultSyncService";
import { adapter } from "./web3adapter/watchers/subscriber";

const app = express();
const PORT = process.env.PROFILE_EDITOR_API_PORT || 3006;

app.use(cors());
app.use(express.json());

const registryService = new RegistryService();
const evaultService = new EVaultProfileService(registryService);

const authController = new AuthController(evaultService);
const profileController = new ProfileController(evaultService);
const discoveryController = new DiscoveryController();
const webhookController = new WebhookController(adapter);

// Webhook route (no auth, receives eVault events)
app.post("/api/webhook", webhookController.handleWebhook);

// Public auth routes
app.get("/api/auth/offer", authController.getOffer);
app.post("/api/auth", authController.login);
app.get("/api/auth/sessions/:id", authController.sseStream);

// Public discovery routes
app.get("/api/discover", discoveryController.discover);

// Public profile view + file proxy routes (authMiddleware is optional here — populates req.user if logged in)
app.get("/api/profiles/:ename", profileController.getPublicProfile);
app.get(
	"/api/profiles/:ename/avatar",
	authMiddleware,
	profileController.getProfileAvatar,
);
app.get(
	"/api/profiles/:ename/banner",
	authMiddleware,
	profileController.getProfileBanner,
);
app.get(
	"/api/profiles/:ename/cv",
	authMiddleware,
	profileController.getProfileCv,
);
app.get(
	"/api/profiles/:ename/video",
	authMiddleware,
	profileController.getProfileVideo,
);

// Protected routes
app.use(authMiddleware);

app.post("/api/files", authGuard, ...fileProxyUpload);

app.get("/api/profile", authGuard, profileController.getProfile);
app.patch("/api/profile", authGuard, profileController.updateProfile);
app.put(
	"/api/profile/work-experience",
	authGuard,
	profileController.updateWorkExperience,
);
app.put("/api/profile/education", authGuard, profileController.updateEducation);
app.put("/api/profile/skills", authGuard, profileController.updateSkills);
app.put(
	"/api/profile/social-links",
	authGuard,
	profileController.updateSocialLinks,
);

AppDataSource.initialize()
	.then(() => {
		console.log("Database connection established");

		const syncService = new EVaultSyncService(evaultService);
		profileController.setSyncService(syncService);
		syncService.start(5 * 60 * 1000);

		app.listen(PORT, () => {
			console.log(`Profile Editor API running on port ${PORT}`);
		});
	})
	.catch((error: any) => {
		console.error("Database connection failed:", error);
		process.exit(1);
	});
