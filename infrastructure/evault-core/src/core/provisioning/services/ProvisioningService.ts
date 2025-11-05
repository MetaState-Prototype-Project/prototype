import axios, { AxiosError } from "axios";
import { W3IDBuilder } from "w3id";
import * as jose from "jose";
import { VerificationService } from "../../../services/VerificationService";

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
    async provisionEVault(request: ProvisionRequest): Promise<ProvisionResponse> {
        try {
            if (!process.env.PUBLIC_REGISTRY_URL) {
                throw new Error("PUBLIC_REGISTRY_URL is not set");
            }

            const { registryEntropy, namespace, verificationId, publicKey } = request;

            if (!registryEntropy || !namespace || !verificationId || !publicKey) {
                return {
                    success: false,
                    error: "Missing required fields",
                    message: "Missing required fields: registryEntropy, namespace, verificationId, publicKey",
                };
            }

            // Verify the registry entropy token
            const jwksResponse = await axios.get(
                new URL(
                    `/.well-known/jwks.json`,
                    process.env.PUBLIC_REGISTRY_URL
                ).toString()
            );

            const JWKS = jose.createLocalJWKSet(jwksResponse.data);
            const { payload } = await jose.jwtVerify(registryEntropy, JWKS);

            // Generate eName (W3ID) from entropy
            const userId = await new W3IDBuilder()
                .withNamespace(namespace)
                .withEntropy(payload.entropy as string)
                .withGlobal(true)
                .build();

            const w3id = userId.id;

            // Validate verification if not demo code
            const demoCode = process.env.DEMO_CODE_W3DS || "d66b7138-538a-465f-a6ce-f6985854c3f4";
            if (verificationId !== demoCode) {
                const verification = await this.verificationService.findById(verificationId);
                if (!verification) {
                    throw new Error("verification doesn't exist");
                }
                if (!verification.approved) {
                    throw new Error("verification not approved");
                }
                if (verification.consumed) {
                    throw new Error("This verification ID has already been used");
                }
            }

            // Update verification with linked eName
            await this.verificationService.findByIdAndUpdate(verificationId, { linkedEName: w3id });

            // Generate evault ID
            const evaultId = await new W3IDBuilder().withGlobal(true).build();

            // Build URI (IP:PORT format pointing to shared evault-core service)
            const baseUri = process.env.EVAULT_BASE_URI || `http://${process.env.EVAULT_HOST || "localhost"}:${process.env.PORT || 4000}`;
            const uri = baseUri;

            // Register in registry
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

            return {
                success: true,
                w3id,
                uri,
            };
        } catch (error) {
            const axiosError = error as AxiosError;
            console.error("Provisioning error:", error);
            return {
                success: false,
                error: axiosError.response?.data || axiosError.message,
                message: "Failed to provision evault instance",
            };
        }
    }
}

