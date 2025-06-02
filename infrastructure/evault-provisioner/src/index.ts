import express, { Request, Response } from "express";
import axios, { AxiosError } from "axios";
import { provisionEVault } from "./templates/evault.nomad.js";
import dotenv from "dotenv";
import { W3IDBuilder } from "w3id";
import * as jose from "jose";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

interface ProvisionRequest {
    registryEntropy: string;
    namespace: string;
}

interface ProvisionResponse {
    success: boolean;
    uri?: string;
    message?: string;
    error?: string | unknown;
}

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
    res.json({ status: "ok" });
});

// Provision evault endpoint
app.post(
    "/provision",
    async (
        req: Request<{}, {}, ProvisionRequest>,
        res: Response<ProvisionResponse>,
    ) => {
        try {

            if (!process.env.REGISTRY_URI) throw new Error("REGISTRY_URI is not set");
            const { registryEntropy, namespace } = req.body;

            if (!registryEntropy || !namespace) {
                return res.status(400).json({
                    success: false,
                    error: "registryEntropy and namespace are required",
                    message:
                        "Missing required fields: registryEntropy, namespace",
                });
            }
            const jwksResponse = await axios.get(
                `http://localhost:4321/.well-known/jwks.json`,
            );

            const JWKS = jose.createLocalJWKSet(jwksResponse.data);

            const { payload } = await jose.jwtVerify(registryEntropy, JWKS);

            const evaultId = await new W3IDBuilder().withGlobal(true).build();
            const userId = await new W3IDBuilder()
                .withNamespace(namespace)
                .withEntropy(payload.entropy as string)
                .withGlobal(true)
                .build();

            const w3id = userId.id;

            const uri = await provisionEVault(w3id, evaultId.id);


            await axios.post(new URL("/register", process.env.REGISTRY_URI).toString(), {
                ename: w3id,
                uri,
                evault: evaultId.id,
            }, {
                headers: {
                    "Authorization": `Bearer ${process.env.REGISTRY_SHARED_SECRET}`
                }
            });

            res.json({
                success: true,
                uri,
            });


        } catch (error) {
            const axiosError = error as AxiosError;
            res.status(500).json({
                success: false,
                error: axiosError.response?.data || axiosError.message,
                message: "Failed to provision evault instance",
            });
        }
    },
);

app.listen(port, () => {
    console.log(`Evault Provisioner API running on port ${port}`);
});
