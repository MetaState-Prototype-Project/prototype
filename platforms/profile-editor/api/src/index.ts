import cors from "cors";
import express from "express";
import { AaasClient } from "./aaas";
import { AuthController } from "./controllers/auth";
import { DiscoverController } from "./controllers/discover";
import { fileUpload } from "./controllers/files";
import { ProfileController } from "./controllers/profile";
import { env } from "./env";
import { EvaultWriter } from "./evault";
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

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// W3DS-native: reads from AaaS, writes to eVault. No database.
const aaas = new AaasClient();
const evault = new EvaultWriter();
const auth = new AuthController(aaas);
const profile = new ProfileController(aaas, evault);
const discover = new DiscoverController(aaas);

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

app.listen(env.port, () => {
    console.log(`Profile Editor API running on port ${env.port}`);
});
