import axios, { type AxiosError } from "axios";
import * as jose from "jose";
import { validate as uuidValidate } from "uuid";
import { W3IDBuilder } from "w3id";
import type { VerificationService } from "./VerificationService";

export interface ProvisionRequest {
    registryEntropy: string;
    namespace: string;
    verificationId: string;
    publicKey: string;
}

export interface ProvisionResponse {
    success: boolean;
    uri?: string;
    w3id?: string;
    message?: string;
    error?: string | unknown;
}

export class ProvisioningService {
    constructor(private verificationService: VerificationService) {}

    /**
     * Provisions a new eVault logically (no infrastructure creation)
     * @param request - Provision request containing registryEntropy, namespace, verificationId, and publicKey
     * @returns Provision response with w3id (eName) and URI
     */
    async provisionEVault(
        request: ProvisionRequest,
    ): Promise<ProvisionResponse> {
        try {
            if (!process.env.PUBLIC_REGISTRY_URL) {
                throw new Error("PUBLIC_REGISTRY_URL is not set");
            }

            const { registryEntropy, namespace, verificationId, publicKey } =
                request;

            if (
                !registryEntropy ||
                !namespace ||
                !verificationId ||
                !publicKey
            ) {
                return {
                    success: false,
                    error: "Missing required fields",
                    message:
                        "Missing required fields: registryEntropy, namespace, verificationId, publicKey",
                };
            }

            // Verify the registry entropy token
            let payload: any;
            try {
                const jwksResponse = await axios.get(
                    new URL(
                        `/.well-known/jwks.json`,
                        process.env.PUBLIC_REGISTRY_URL,
                    ).toString(),
                );

                const JWKS = jose.createLocalJWKSet(jwksResponse.data);
                const verified = await jose.jwtVerify(registryEntropy, JWKS);
                payload = verified.payload;
            } catch (jwtError) {
                // If JWT verification fails, re-throw with a clearer message
                // but preserve the original error for debugging
                throw new Error(
                    `JWT verification failed: ${
                        jwtError instanceof Error
                            ? jwtError.message
                            : String(jwtError)
                    }`,
                );
            }

            if (!uuidValidate(namespace)) {
                return {
                    success: false,
                    error: "Invalid namespace",
                    message: "Namespace must be a valid UUID",
                };
            }

            let w3id: string;
            try {
                const userId = await new W3IDBuilder()
                    .withNamespace(namespace)
                    .withEntropy(payload.entropy as string)
                    .withGlobal(true)
                    .build();
                w3id = userId.id;
            } catch (w3idError) {
                // If W3ID generation fails, it's likely an entropy format issue
                // Re-throw with clearer message, but let verification errors take precedence
                throw new Error(
                    `Failed to generate W3ID from entropy: ${
                        w3idError instanceof Error
                            ? w3idError.message
                            : String(w3idError)
                    }`,
                );
            }

            // Validate verification if not demo code
            const demoCode = process.env.DEMO_CODE_W3DS || "d66b7138-538a-465f-a6ce-f6985854c3f4";
            if (verificationId !== demoCode) {
                let verification;
                try {
                    verification =
                        await this.verificationService.findById(verificationId);
                } catch (dbError) {
                    // If database query fails (e.g., invalid UUID format), treat as verification not found
                    throw new Error("verification doesn't exist");
                }
                if (!verification) {
                    throw new Error("verification doesn't exist");
                }
                if (!verification.approved) {
                    throw new Error("verification not approved");
                }
                if (verification.consumed) {
                    throw new Error("already been used");
                }
            }

            // Update verification with linked eName (only if not demo code)
            if (verificationId !== demoCode) {
                try {
                    await this.verificationService.findByIdAndUpdate(
                        verificationId,
                        {
                            linkedEName: w3id,
                            consumed: true,
                        },
                    );
                } catch (updateError) {
                    // If update fails, it means verification doesn't exist (should have been caught above, but handle gracefully)
                    throw new Error("verification doesn't exist");
                }
            }

            // Generate evault ID (doesn't need entropy, generates random)
            let evaultId: { id: string };
            try {
                evaultId = await new W3IDBuilder().withGlobal(true).build();
            } catch (evaultIdError) {
                throw new Error(
                    `Failed to generate evault ID: ${
                        evaultIdError instanceof Error
                            ? evaultIdError.message
                            : String(evaultIdError)
                    }`,
                );
            }

            // Build URI (IP:PORT format pointing to shared service)
            const fastifyPort =
                process.env.FASTIFY_PORT || process.env.PORT || 4000;
            const baseUri =
                process.env.EVAULT_BASE_URI ||
                `http://${
                    process.env.EVAULT_HOST || "localhost"
                }:${fastifyPort}`;
            const uri = baseUri;

            // Register in registry
            await axios.post(
                new URL(
                    "/register",
                    process.env.PUBLIC_REGISTRY_URL,
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
                },
            );

            return {
                success: true,
                w3id,
                uri,
            };
        } catch (error) {
            const axiosError = error as AxiosError;
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            console.error("Provisioning error:", error);

            // Preserve specific verification-related error messages, otherwise use generic message
            const verificationErrors = [
                "verification doesn't exist",
                "verification not approved",
                "already been used",
                "PUBLIC_REGISTRY_URL",
            ];

            const isVerificationError = verificationErrors.some((err) =>
                errorMessage.includes(err),
            );
            const message = isVerificationError
                ? errorMessage
                : "Failed to provision evault instance";

            return {
                success: false,
                error: axiosError.response?.data || errorMessage,
                message,
            };
        }
    }
}
