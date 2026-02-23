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
    duplicate?: boolean;
    existingW3id?: string;
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

    private async createPhotographBindingDocument(
        w3id: string,
        portraitImageUrl: string,
    ): Promise<void> {
        const evaultUrl = process.env.PUBLIC_EVAULT_SERVER_URI;
        if (!evaultUrl) {
            console.error("[BINDING_DOC] PUBLIC_EVAULT_SERVER_URI not set, skipping photograph binding document");
            return;
        }

        const imageResponse = await axios.get(portraitImageUrl, { responseType: "arraybuffer" });
        const contentType = (imageResponse.headers["content-type"] as string | undefined) ?? "image/jpeg";
        const base64 = Buffer.from(imageResponse.data as ArrayBuffer).toString("base64");
        const photoBlob = `data:${contentType};base64,${base64}`;

        const subject = w3id.startsWith("@") ? w3id : `@${w3id}`;
        const data = { photoBlob };
        const ownerSignature = signAsProvisioner({
            subject,
            type: "photograph",
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
                    input: { subject, type: "photograph", data, ownerSignature },
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
            console.error("[BINDING_DOC] Photograph GraphQL errors:", errors);
        } else {
            console.log(`[BINDING_DOC] Created photograph binding doc for ${subject}`);
        }
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

    private async updateUserProfileInEvault(w3id: string, displayName: string): Promise<void> {
        const evaultUrl = process.env.PUBLIC_EVAULT_SERVER_URI;
        if (!evaultUrl) {
            console.error("[PROFILE] PUBLIC_EVAULT_SERVER_URI not set, skipping profile update");
            return;
        }

        const subject = w3id.startsWith("@") ? w3id : `@${w3id}`;
        const token = await this.getPlatformToken();
        const gqlUrl = new URL("/graphql", evaultUrl).toString();
        const USER_PROFILE_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440000";

        // Find the existing UserProfile envelope
        const queryRes = await axios.post(
            gqlUrl,
            {
                query: `query {
                    metaEnvelopes(filter: { ontologyId: "${USER_PROFILE_ONTOLOGY}" }, first: 1) {
                        edges { node { id ontology parsed } }
                    }
                }`,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-ENAME": subject,
                    Authorization: `Bearer ${token}`,
                },
            },
        );

        const edges = queryRes.data?.data?.metaEnvelopes?.edges ?? [];
        if (edges.length === 0) {
            console.warn(`[PROFILE] No UserProfile envelope found for ${subject}, skipping update`);
            return;
        }

        const existing = edges[0].node;
        const updatedPayload = {
            ...(existing.parsed ?? {}),
            displayName,
            isVerified: true,
            updatedAt: new Date().toISOString(),
        };

        const updateRes = await axios.post(
            gqlUrl,
            {
                query: `mutation UpdateMetaEnvelope($id: ID!, $input: MetaEnvelopeInput!) {
                    updateMetaEnvelope(id: $id, input: $input) {
                        metaEnvelope { id }
                        errors { message code }
                    }
                }`,
                variables: {
                    id: existing.id,
                    input: {
                        ontology: USER_PROFILE_ONTOLOGY,
                        payload: updatedPayload,
                        acl: ["*"],
                    },
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

        const errors = updateRes.data?.data?.updateMetaEnvelope?.errors;
        if (errors?.length) {
            console.error("[PROFILE] updateMetaEnvelope errors:", errors);
        } else {
            console.log(`[PROFILE] Updated UserProfile for ${subject} — displayName: ${displayName}, isVerified: true`);
        }
    }

    /**
     * Upgrades an existing eVault by creating binding documents and updating the UserProfile.
     * Called when an already-provisioned user completes identity verification.
     */
    async upgradeExistingEVault(diditSessionId: string, w3id: string): Promise<{ success: boolean; message?: string; duplicate?: boolean; existingW3id?: string }> {
        const apiKey = process.env.DIDIT_API_KEY;
        if (!apiKey) return { success: false, message: "DIDIT_API_KEY is not configured" };

        let decision: any;
        try {
            const { data } = await diditAxios.get(
                `/v3/session/${diditSessionId}/decision/`,
                { headers: { "x-api-key": apiKey } },
            );
            decision = data;
        } catch (err: any) {
            console.error("[UPGRADE] Failed to fetch Didit decision:", err?.response?.data ?? err?.message);
            return { success: false, message: "Failed to fetch verification decision" };
        }

        const status: string = decision?.status ?? "";
        if (status.toLowerCase() !== "approved") {
            return { success: false, message: "verification not approved" };
        }

        const idVerif = decision.id_verifications?.[0];
        const firstName = idVerif?.first_name ?? "";
        const lastName = idVerif?.last_name ?? "";
        const fullName = (idVerif?.full_name ?? `${firstName} ${lastName}`).trim();
        const documentNumber: string = idVerif?.document_number ?? "";

        // --- Duplicate check: Scenario A — Didit matches array ---
        const matches: any[] = idVerif?.matches ?? [];
        for (const match of matches) {
            if (match.status?.toLowerCase() !== "approved") continue;
            const matchVendorData: string = match.vendor_data ?? "";
            if (!matchVendorData) continue;
            const matchVerif = await this.verificationService.findOne({ id: matchVendorData });
            // Only flag as duplicate if the linked eVault is a different eName
            if (matchVerif?.linkedEName && matchVerif.linkedEName !== w3id) {
                console.warn(`[UPGRADE] Duplicate detected via Didit match: existing=${matchVerif.linkedEName}`);
                return {
                    success: false,
                    duplicate: true,
                    existingW3id: matchVerif.linkedEName,
                    message: "duplicate identity",
                };
            }
        }

        // --- Duplicate check: Scenario B — legacy document number ---
        if (documentNumber) {
            const [docMatches] = await this.verificationService.findManyAndCount(
                { documentId: documentNumber },
            );
            const existing = docMatches.find((v) => !!v.linkedEName && v.linkedEName !== w3id);
            if (existing) {
                console.warn(`[UPGRADE] Duplicate detected via documentId: existing=${existing.linkedEName}`);
                return {
                    success: false,
                    duplicate: true,
                    existingW3id: existing.linkedEName,
                    message: "duplicate identity",
                };
            }
        }

        // Persist the upgrade into the Verification table so future duplicate checks work.
        // Find the record by diditSessionId (created when the session was started).
        const verificationRecord = await this.verificationService.findOne({ diditSessionId });
        if (verificationRecord) {
            await this.verificationService.findByIdAndUpdate(verificationRecord.id, {
                approved: true,
                consumed: true,
                linkedEName: w3id,
                data: { decision },
                ...(documentNumber ? { documentId: documentNumber } : {}),
            });
            console.log(`[UPGRADE] Persisted linkedEName=${w3id} for verification ${verificationRecord.id}`);
        } else {
            // No matching record — create one so future Didit match lookups work.
            // vendor_data on the Didit session already points to the original verification.id,
            // but if a new session was created for the upgrade we need a record here too.
            console.warn(`[UPGRADE] No Verification record found for diditSessionId=${diditSessionId}, creating one`);
            await this.verificationService.create({
                diditSessionId,
                approved: true,
                consumed: true,
                linkedEName: w3id,
                data: { decision },
                ...(documentNumber ? { documentId: documentNumber } : {}),
            });
        }

        // Create id_document binding doc
        if (fullName) {
            this.createBindingDocumentForUser(w3id, diditSessionId, fullName).catch(
                (err) => console.error("[UPGRADE] id_document binding doc error:", err),
            );
        }

        // Create photograph binding doc from ID document portrait
        const selfieUrl: string = idVerif?.portrait_image ?? "";
        if (selfieUrl) {
            this.createPhotographBindingDocument(w3id, selfieUrl).catch(
                (err) => console.error("[UPGRADE] photograph binding doc error:", err),
            );
        }

        // Update UserProfile with verified name
        if (fullName) {
            this.updateUserProfileInEvault(w3id, fullName).catch(
                (err) => console.error("[UPGRADE] profile update error:", err),
            );
        }

        return { success: true };
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

                // --- Scenario A: Didit session matches (same document used before) ---
                const idVerif = decision.id_verifications?.[0];
                const documentNumber: string = idVerif?.document_number ?? "";
                const matches: any[] = idVerif?.matches ?? [];
                for (const match of matches) {
                    if (match.status?.toLowerCase() !== "approved") continue;
                    const matchVendorData: string = match.vendor_data ?? "";
                    if (!matchVendorData) continue;
                    const matchVerif = await this.verificationService.findOne({ id: matchVendorData });
                    if (matchVerif?.linkedEName) {
                        return {
                            success: false,
                            duplicate: true,
                            existingW3id: matchVerif.linkedEName,
                            message: "duplicate identity",
                        };
                    }
                }

                // --- Scenario B: Legacy document number match (pre-Didit / Veriff eVaults) ---
                if (documentNumber) {
                    const [docMatches] = await this.verificationService.findManyAndCount(
                        { documentId: documentNumber },
                    );
                    const existing = docMatches.find((v) => !!v.linkedEName);
                    if (existing) {
                        return {
                            success: false,
                            duplicate: true,
                            existingW3id: existing.linkedEName,
                            message: "duplicate identity",
                        };
                    }
                }

                // Persist approval, document number, linked eName, and consumed flag in one update
                await this.verificationService.findByIdAndUpdate(verificationId, {
                    approved: true,
                    consumed: true,
                    linkedEName: w3id,
                    data: { decision },
                    ...(documentNumber ? { documentId: documentNumber } : {}),
                });
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

            // After provisioning, create provisioner-signed binding documents from Didit data
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

                const portraitUrl: string = decision.id_verifications?.[0]?.portrait_image ?? "";
                if (portraitUrl) {
                    this.createPhotographBindingDocument(w3id, portraitUrl).catch(
                        (err) => console.error("[BINDING_DOC] Portrait error:", err),
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
