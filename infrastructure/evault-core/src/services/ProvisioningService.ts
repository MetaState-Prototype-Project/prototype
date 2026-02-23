import axios, { type AxiosError } from "axios";
import * as jose from "jose";

const diditAxios = axios.create({ baseURL: "https://verification.didit.me" });
import { validate as uuidValidate } from "uuid";
import { W3IDBuilder } from "w3id";
import { signAsProvisioner } from "../core/utils/provisioner-signer";
import type { VerificationService } from "./VerificationService";

export interface ProvisionRequest {
    registryEntropy: string;
    namespace: string;
    verificationId: string;
    publicKey?: string;
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

    private async getPlatformToken(): Promise<string> {
        const registryUrl = process.env.PUBLIC_REGISTRY_URL;
        const platformName = process.env.PLATFORM_NAME ?? "provisioner";
        if (!registryUrl) throw new Error("PUBLIC_REGISTRY_URL is not set");
        const res = await axios.post(
            new URL("/platforms/certification", registryUrl).toString(),
            { platform: platformName },
            { headers: { "Content-Type": "application/json" } },
        );
        return res.data.token as string;
    }

    private async createBindingDocumentForUser(
        w3id: string,
        diditSessionId: string,
        fullName: string,
    ): Promise<void> {
        const evaultUrl = process.env.PUBLIC_EVAULT_SERVER_URI;
        if (!evaultUrl) {
            console.error("[BINDING_DOC] PUBLIC_EVAULT_SERVER_URI not set, skipping");
            return;
        }

        const subject = w3id.startsWith("@") ? w3id : `@${w3id}`;
        const data = { vendor: "didit", reference: diditSessionId, name: fullName };
        const ownerSignature = signAsProvisioner({
            subject,
            type: "id_document",
            data: data as any,
        });

        const token = await this.getPlatformToken();

        const gqlUrl = new URL("/graphql", evaultUrl).toString();
        const response = await axios.post(
            gqlUrl,
            {
                query: `mutation CreateBindingDocument($input: CreateBindingDocumentInput!) {
                    createBindingDocument(input: $input) {
                        metaEnvelopeId
                        errors { message code }
                    }
                }`,
                variables: {
                    input: { subject, type: "id_document", data, ownerSignature },
                },
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-ENAME": subject,
                    Authorization: `Bearer ${token}`,
                },
            },
        );

        const errors = response.data?.data?.createBindingDocument?.errors;
        if (errors?.length) {
            console.error("[BINDING_DOC] GraphQL errors:", errors);
        } else {
            console.log(`[BINDING_DOC] Created id_document binding doc for ${subject}`);
        }
    }

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
                !verificationId
            ) {
                return {
                    success: false,
                    error: "Missing required fields",
                    message:
                        "Missing required fields: registryEntropy, namespace, verificationId",
                };
            }

            // Log if keyless provisioning
            if (!publicKey) {
                console.log(`[PROVISIONING] Keyless eVault provisioning (no publicKey provided)`);
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
                    `JWT verification failed: ${jwtError instanceof Error
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
                    `Failed to generate W3ID from entropy: ${w3idError instanceof Error
                        ? w3idError.message
                        : String(w3idError)
                    }`,
                );
            }

            // Validate verification if not demo code
            const demoCode = process.env.DEMO_CODE_W3DS || "d66b7138-538a-465f-a6ce-f6985854c3f4";
            let decision: any = null;
            if (verificationId !== demoCode) {
                let verification;
                try {
                    verification = await this.verificationService.findById(verificationId);
                } catch (dbError) {
                    throw new Error("verification doesn't exist");
                }
                if (!verification) {
                    throw new Error("verification doesn't exist");
                }
                if (verification.consumed) {
                    throw new Error("already been used");
                }
                if (!verification.diditSessionId) {
                    throw new Error("verification not approved");
                }

                // Pull live decision from Didit API
                const apiKey = process.env.DIDIT_API_KEY;
                if (!apiKey) throw new Error("DIDIT_API_KEY is not configured");

                try {
                    const { data: diditDecision } = await diditAxios.get(
                        `/v3/session/${verification.diditSessionId}/decision/`,
                        { headers: { "x-api-key": apiKey } },
                    );
                    decision = diditDecision;
                } catch (err: any) {
                    console.error("[PROVISIONING] Failed to fetch Didit decision:", err?.response?.data ?? err?.message);
                    throw new Error("verification not approved");
                }

                const diditStatus: string = decision?.status ?? "";
                if (diditStatus.toLowerCase() !== "approved") {
                    throw new Error("verification not approved");
                }

                // Persist approval so consumed check works on retry
                await this.verificationService.findByIdAndUpdate(verificationId, {
                    approved: true,
                    data: { decision },
                });
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
                    `Failed to generate evault ID: ${evaultIdError instanceof Error
                        ? evaultIdError.message
                        : String(evaultIdError)
                    }`,
                );
            }

            // Build URI (IP:PORT format pointing to shared service)
            const uri = process.env.PUBLIC_EVAULT_SERVER_URI;
            console.log("URI set", uri)

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

            // After provisioning, create the provisioner-signed id_document binding document
            if (verificationId !== demoCode && decision) {
                const idVerif = decision.id_verifications?.[0];
                const firstName = idVerif?.first_name ?? "";
                const lastName = idVerif?.last_name ?? "";
                const fullName = (idVerif?.full_name ?? `${firstName} ${lastName}`).trim();
                const verificationRecord = await this.verificationService.findById(verificationId);
                const diditSessionId = verificationRecord?.diditSessionId ?? "";

                if (fullName && diditSessionId) {
                    this.createBindingDocumentForUser(w3id, diditSessionId, fullName).catch(
                        (err) => console.error("[BINDING_DOC] Post-provision error:", err),
                    );
                }
            }

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
