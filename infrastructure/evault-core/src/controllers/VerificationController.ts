import { Request, Response } from "express";
import { default as Axios } from "axios";
import { VerificationService } from "../services/VerificationService";
import { eventEmitter } from "../utils/eventEmitter";
import { signAsProvisioner } from "../core/utils/provisioner-signer";
import { computeBindingDocumentHash } from "../core/utils/binding-document-hash";

const diditClient = Axios.create({
    baseURL: "https://verification.didit.me",
});

async function getPlatformToken(): Promise<string> {
    const registryUrl = process.env.PUBLIC_REGISTRY_URL;
    const platformName = process.env.PLATFORM_NAME ?? "provisioner";
    if (!registryUrl) throw new Error("PUBLIC_REGISTRY_URL is not set");
    const res = await Axios.post(
        new URL("/platforms/certification", registryUrl).toString(),
        { platform: platformName },
        { headers: { "Content-Type": "application/json" } },
    );
    return res.data.token as string;
}

async function createBindingDocumentOnEvault(
    w3id: string,
    diditSessionId: string,
    fullName: string,
): Promise<void> {
    const evaultUrl = process.env.PUBLIC_EVAULT_SERVER_URI;
    if (!evaultUrl) {
        console.error("[BINDING_DOC] PUBLIC_EVAULT_SERVER_URI is not set, skipping binding document creation");
        return;
    }

    const subject = w3id.startsWith("@") ? w3id : `@${w3id}`;
    const data = { vendor: "didit", reference: diditSessionId, name: fullName };
    const ownerSignature = signAsProvisioner({
        subject,
        type: "id_document",
        data: data as any,
    });

    let token: string;
    try {
        token = await getPlatformToken();
    } catch (err) {
        console.error("[BINDING_DOC] Failed to get platform token:", err);
        return;
    }

    const gqlUrl = new URL("/graphql", evaultUrl).toString();
    try {
        const response = await Axios.post(
            gqlUrl,
            {
                query: `mutation CreateBindingDocument($input: CreateBindingDocumentInput!) {
                    createBindingDocument(input: $input) {
                        metaEnvelopeId
                        errors { message code }
                    }
                }`,
                variables: {
                    input: {
                        subject,
                        type: "id_document",
                        data,
                        ownerSignature,
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
        const errors = response.data?.data?.createBindingDocument?.errors;
        if (errors?.length) {
            console.error("[BINDING_DOC] GraphQL errors:", errors);
        } else {
            console.log(`[BINDING_DOC] Created id_document binding doc for ${subject}`);
        }
    } catch (err) {
        console.error("[BINDING_DOC] Failed to create binding document:", err);
    }
}

export class VerificationController {
    constructor(private readonly verificationService: VerificationService) {}

    registerRoutes(app: any) {
        // SSE endpoint for verification status updates
        app.get(
            "/verification/sessions/:id",
            async (req: Request, res: Response) => {
                const { id } = req.params;

                res.writeHead(200, {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    Connection: "keep-alive",
                    "Access-Control-Allow-Origin": "*",
                });

                res.write(
                    `event: connected\ndata: ${JSON.stringify({ hi: "hi" })}\n\n`,
                );

                const handler = (data: any) => {
                    res.write(`data: ${JSON.stringify(data)}\n\n`);
                };

                eventEmitter.on(id, handler);

                req.on("close", () => {
                    eventEmitter.off(id, handler);
                    res.end();
                });

                req.on("error", (error) => {
                    console.error("SSE Error:", error);
                    eventEmitter.off(id, handler);
                    res.end();
                });
            },
        );

        // Get verification session
        app.get("/verification/:id", async (req: Request, res: Response) => {
            const { id } = req.params;
            const session = await this.verificationService.findById(id);
            if (!session) {
                return res.status(404).json({ error: "Verification session not found" });
            }
            return res.json(session);
        });

        // Create new Didit verification session
        app.post("/verification", async (req: Request, res: Response) => {
            console.log("Creating new Didit verification session");
            const { referenceId } = req.body;

            if (referenceId) {
                const existing = await this.verificationService.findOne({ referenceId });
                if (existing) {
                    return res.status(409).json({ error: "Reference ID Already Exists" });
                }
            }

            const verification = await this.verificationService.create({ referenceId });

            const apiKey = process.env.DIDIT_API_KEY;
            const workflowId = process.env.DIDIT_WORKFLOW_ID;
            if (!apiKey || !workflowId) {
                return res.status(500).json({ error: "Didit API key or workflow ID not configured" });
            }

            const { data: diditSession } = await diditClient.post(
                "/v3/session/",
                {
                    workflow_id: workflowId,
                    vendor_data: verification.id,
                },
                {
                    headers: {
                        "x-api-key": apiKey,
                        "Content-Type": "application/json",
                    },
                },
            );

            console.log("[Didit] Session response:", JSON.stringify(diditSession));

            // Didit returns session_id and session_token; build the verification URL from the token
            const sessionToken: string = diditSession.session_token;
            const sessionId: string = diditSession.session_id ?? diditSession.id ?? verification.id;
            const verificationUrl: string =
                diditSession.verification_url ??
                diditSession.url ??
                `https://verify.didit.me/session/${sessionToken}`;

            await this.verificationService.findByIdAndUpdate(verification.id, {
                diditSessionId: sessionId,
                verificationUrl,
                sessionToken,
            });

            return res.status(201).json({
                id: verification.id,
                sessionToken,
                verificationUrl,
            });
        });

        // Webhook for Didit verification decisions
        app.post(
            "/verification/decisions",
            async (req: Request, res: Response) => {
                const body = req.body;
                console.log("[DIDIT WEBHOOK]", JSON.stringify(body));

                // Didit sends vendor_data as the local verification ID
                const id = body.vendor_data ?? body.vendorData;
                let w3id: string | null = null;

                const verification = await this.verificationService.findById(id);
                if (!verification) {
                    return res.status(404).json({ error: "Verification not found" });
                }

                // Didit status: "Approved" | "Declined" | "In Review" | "Expired" | "Abandoned"
                const diditStatus: string = body.status ?? body.session?.status ?? "";
                const normalizedStatus = diditStatus.toLowerCase();

                // Extract person/document from Didit's kyc object
                const kyc = body.kyc ?? body.session?.kyc ?? {};
                const documentInfo = kyc.document ?? {};
                const personalInfo = kyc.personal_data ?? {};

                const firstName = personalInfo.first_name ?? documentInfo.first_name ?? "";
                const lastName = personalInfo.last_name ?? documentInfo.last_name ?? "";
                const fullName = `${firstName} ${lastName}`.trim();
                const documentNumber = documentInfo.document_number ?? documentInfo.number ?? "";
                const dateOfBirth = personalInfo.date_of_birth ?? documentInfo.date_of_birth ?? "";
                const documentType = documentInfo.document_type ?? "unknown";
                const country = documentInfo.issuing_country ?? documentInfo.country ?? "";

                // Map Didit status to internal status
                let status = normalizedStatus;
                let reason = normalizedStatus;

                const affirmativeStatuses = ["approved", "declined", "expired", "abandoned"];
                if (affirmativeStatuses.includes(normalizedStatus)) {
                    const approved = normalizedStatus === "approved";

                    if (approved && process.env.DUPLICATES_POLICY !== "allow" && documentNumber) {
                        const [matches] = await this.verificationService.findManyAndCount({
                            documentId: documentNumber,
                        });
                        const verificationMatch = matches.find((v) => !!v.linkedEName);
                        if (verificationMatch) {
                            status = "duplicate";
                            reason = "Document already used to create an eVault";
                            w3id = verificationMatch.linkedEName;
                        }
                    }

                    await this.verificationService.findByIdAndUpdate(id, {
                        approved,
                        data: { person: personalInfo, document: documentInfo },
                        documentId: documentNumber,
                    });
                }

                // Normalise to the shape the frontend expects (mirrors old Veriff shape)
                const person = {
                    firstName: { value: firstName },
                    lastName: { value: lastName },
                    dateOfBirth: { value: dateOfBirth },
                };
                const document = {
                    type: { value: documentType },
                    country: { value: country },
                    number: { value: documentNumber },
                    validFrom: { value: documentInfo.valid_from ?? documentInfo.date_of_issue ?? "" },
                    validUntil: { value: documentInfo.expiry_date ?? documentInfo.valid_until ?? "" },
                };

                eventEmitter.emit(id, { status, reason, w3id, person, document });

                // After a clean approval (not duplicate), create the provisioner-signed binding document
                // This happens asynchronously after the provisioning step sets linkedEName
                if (status === "approved" && fullName && verification.linkedEName) {
                    const diditSessionId = verification.diditSessionId ?? body.session_id ?? "";
                    createBindingDocumentOnEvault(verification.linkedEName, diditSessionId, fullName).catch(
                        (err) => console.error("[BINDING_DOC] Async error:", err),
                    );
                }

                return res.json({ success: true });
            },
        );
    }
}
