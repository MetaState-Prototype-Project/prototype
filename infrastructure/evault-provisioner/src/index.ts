import express, { Request, Response } from "express";
import axios, { AxiosError } from "axios";
import { generateNomadJob } from "./templates/evault.nomad.js";
import dotenv from "dotenv";
import { subscribeToAlloc } from "./listeners/alloc.js";
import { W3IDBuilder } from "w3id";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

interface ProvisionRequest {
    w3id: string;
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
            const { w3id } = req.body;

            if (!w3id) {
                return res.status(400).json({
                    success: false,
                    error: "tenantId is required",
                    message: "Missing required field: tenantId",
                });
            }

            const evaultId = await new W3IDBuilder().withGlobal(true).build();

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
