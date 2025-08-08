import "reflect-metadata";
import express, { Request, Response } from "express";
import axios, { AxiosError } from "axios";
import { provisionEVault } from "./templates/evault.nomad";
import dotenv from "dotenv";
import { W3IDBuilder } from "w3id";
import * as jose from "jose";
import path from "path";
import { createHmacSignature } from "./utils/hmac";
import cors from "cors";
import { AppDataSource } from "./config/database";
import { VerificationService } from "./services/VerificationService";
import { VerificationController } from "./controllers/VerificationController";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const app = express();
const port = process.env.PORT || 3001;

// Configure CORS for SSE
app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST", "OPTIONS", "PATCH"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    })
);

// Increase JSON payload limit to 50MB
app.use(express.json({ limit: "50mb" }));
// Increase URL-encoded payload limit to 50MB
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize database connection
const initializeDatabase = async () => {
    try {
        await AppDataSource.initialize();
        console.log("Database connection initialized");
    } catch (error) {
        console.error("Error during database initialization:", error);
        process.exit(1);
    }
};

// Initialize services and controllers
const verificationService = new VerificationService(
    AppDataSource.getRepository("Verification")
);
const verificationController = new VerificationController(verificationService);

interface ProvisionRequest {
    registryEntropy: string;
    namespace: string;
    verificationId: string;
}

interface ProvisionResponse {
    success: boolean;
    uri?: string;
    w3id?: string;
    message?: string;
    error?: string | unknown;
}

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
    res.json({ status: "ok" });
});

export const DEMO_CODE_W3DS = "d66b7138-538a-465f-a6ce-f6985854c3f4";

// Provision evault endpoint
app.post(
    "/provision",
    async (
        req: Request<{}, {}, ProvisionRequest>,
        res: Response<ProvisionResponse>
    ) => {
        try {
            console.log("provisioner log 1");
            if (!process.env.PUBLIC_REGISTRY_URL)
                throw new Error("PUBLIC_REGISTRY_URL is not set");
            const { registryEntropy, namespace, verificationId } = req.body;
            if (!registryEntropy || !namespace || !verificationId) {
                return res.status(400).json({
                    success: false,
                    error: "registryEntropy and namespace are required",
                    message:
                        "Missing required fields: registryEntropy, namespace, verifficationId",
                });
            }

            console.log("provisioner log 2");

            const jwksResponse = await axios.get(
                new URL(
                    `/.well-known/jwks.json`,
                    process.env.PUBLIC_REGISTRY_URL
                ).toString()
            );

            const JWKS = jose.createLocalJWKSet(jwksResponse.data);
            const { payload } = await jose.jwtVerify(registryEntropy, JWKS);

            console.log("provisioner log 3");

            const userId = await new W3IDBuilder()
                .withNamespace(namespace)
                .withEntropy(payload.entropy as string)
                .withGlobal(true)
                .build();

            const w3id = userId.id;

            if (verificationId !== DEMO_CODE_W3DS) {
                const verification = await verificationService.findById(
                    verificationId
                );
                if (!verification)
                    throw new Error("verification doesn't exist");
                if (!verification.approved)
                    throw new Error("verification not approved");
                if (verification.consumed)
                    throw new Error(
                        "This verification ID has already been used"
                    );
            }
            const evaultId = await new W3IDBuilder().withGlobal(true).build();
            const uri = await provisionEVault(
                w3id,
                process.env.PUBLIC_REGISTRY_URL
            );
            await axios.post(
                new URL(
                    "/register",
                    process.env.PUBLIC_REGISTRY_URL
                ).toString(),
                {
                    ename: w3id,
                    uri,
                    evault: evaultId.id,
                },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.REGISTRY_SHARED_SECRET}`,
                    },
                }
            );

            res.json({
                success: true,
                w3id,
                uri,
            });
        } catch (error) {
            const axiosError = error as AxiosError;
            console.error(error);
            res.status(500).json({
                success: false,
                error: axiosError.response?.data || axiosError.message,
                message: "Failed to provision evault instance",
            });
        }
    }
);

// Register verification routes
verificationController.registerRoutes(app);

// Start the server
const start = async () => {
    try {
        await initializeDatabase();
        app.listen(port, () => {
            console.log(`Evault Provisioner API running on port ${port}`);
        });
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

start();
