import express, { Request, Response } from "express";
import axios, { AxiosError } from "axios";
import { generateNomadJob } from "./templates/evault.nomad.js";
import dotenv from "dotenv";
import { subscribeToAlloc } from "./listeners/alloc.js";
import { W3IDBuilder } from "w3id";
import * as jose from "jose";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

interface ProvisionRequest {
    registryEntropy: string;
    namespace: string;
}

interface ProvisionResponse {
    success: boolean;
    message: string;
    jobName?: string;
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
            // TODO: change this to take namespace from the payload, and signed entropy
            // JWT so that we can verify both parts of the UUID come from know source
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

            const jobJSON = generateNomadJob(w3id, evaultId.id);
            const jobName = `evault-${w3id}`;

            const { data } = await axios.post(
                "http://localhost:4646/v1/jobs",
                jobJSON,
            );
            const evalId = data.EvalID;

            const sub = subscribeToAlloc(evalId);
            sub.on("ready", async (allocId) => {
                console.log("Alloc is ready:", allocId);
            });
            sub.on("error", (err) => {
                console.error("Alloc wait failed:", err);
            });

            res.json({
                success: true,
                message: `Successfully provisioned evault for tenant ${w3id}`,
                jobName,
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
