<script lang="ts">
import { goto } from "$app/navigation";
import {
    PUBLIC_EID_WALLET_TOKEN,
    PUBLIC_PROVISIONER_SHARED_SECRET,
    PUBLIC_PROVISIONER_URL,
    PUBLIC_REGISTRY_URL,
} from "$env/static/public";
import { Hero } from "$lib/fragments";
import { GlobalState } from "$lib/global";
import { pendingRecovery } from "$lib/stores/pendingRecovery";
import { ButtonAction } from "$lib/ui";
import { capitalize } from "$lib/utils";
import axios from "axios";
import { GraphQLClient } from "graphql-request";
import { getContext, onMount } from "svelte";
import { Shadow } from "svelte-loading-spinners";
import { Md5 } from "ts-md5";
import { v4 as uuidv4 } from "uuid";
import { provision } from "wallet-sdk";

function computeBindingDocumentHash(doc: {
    subject: string;
    type: string;
    data: Record<string, unknown>;
}): string {
    return Md5.hashStr(
        JSON.stringify({
            subject: doc.subject,
            type: doc.type,
            data: doc.data,
        }),
    );
}

const ANONYMOUS_VERIFICATION_CODE = "d66b7138-538a-465f-a6ce-f6985854c3f4";
const KEY_ID = "default";

type Step =
    | "home"
    | "new-evault"
    | "already-have"
    | "kyc-panel"
    | "didit-verification"
    | "verif-result"
    | "anonymous-form"
    | "loading"
    | "ename-recovery"
    | "ename-passphrase-check"
    | "ename-passphrase";

interface DiditWarning {
    short_description?: string;
}

interface DiditIdVerification {
    warnings?: DiditWarning[];
    full_name?: string;
    first_name?: string;
    last_name?: string;
    date_of_birth?: string;
    document_type?: string;
    document_number?: string;
    issuing_state_name?: string;
    issuing_state?: string;
    expiration_date?: string;
    date_of_issue?: string;
}

interface DiditDecision {
    status?: string;
    reviews?: Array<{ comment?: string }>;
    id_verifications?: DiditIdVerification[];
    session_id?: string;
    session?: {
        sessionId?: string;
    };
}

interface DiditCompleteResult {
    type?: string;
    session?: {
        sessionId?: string;
    };
}

let step = $state<Step>("home");
let error = $state<string | null>(null);
let loading = $state(false);

// KYC panel sub-state
let checkingHardware = $state(false);
let showHardwareError = $state(false);

// eName + passphrase recovery state
let enameInput = $state("");
let enamePassphraseInput = $state("");
let enameError = $state<string | null>(null);
let enameLoading = $state(false);
let showEnameDeadEndDrawer = $state(false);
let showNotaryDrawer = $state(false);

// Didit verification state
let diditLocalId = $state<string | null>(null);
let diditSessionId = $state<string | null>(null);
let diditActualSessionId = $state<string | null>(null); // real Didit sessionId from onComplete
let diditResult = $state<"approved" | "declined" | "in_review" | null>(null);
let diditDecision = $state<DiditDecision | null>(null);
let diditRejectionReason = $state<string | null>(null);

// Upgrade mode — set when ?upgrade=1 is present (existing eVault KYC upgrade)
let upgradeMode = $state(false);

// Anonymous form inputs
let anonName = $state("");
let anonDob = $state("");

const globalState = getContext<() => GlobalState>("globalState")();

function generatePassportNumber() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const randomLetters = () =>
        letters.charAt(Math.floor(Math.random() * letters.length)) +
        letters.charAt(Math.floor(Math.random() * letters.length));
    const randomDigits = () =>
        String(Math.floor(1000000 + Math.random() * 9000000));
    return randomLetters() + randomDigits();
}

// ── Identity / KYC path ───────────────────────────────────────────────────────

const handleIdentityPath = async () => {
    step = "kyc-panel";
    checkingHardware = true;
    showHardwareError = false;
    error = null;

    try {
        globalState.userController.isFake = false;
        const hardwareAvailable = await globalState.keyService.probeHardware();
        if (!hardwareAvailable) {
            throw new Error(
                "Hardware-backed keys not available on this device",
            );
        }
        checkingHardware = false;
    } catch (err) {
        console.error("Hardware key test failed:", err);
        showHardwareError = true;
        checkingHardware = false;
    }
};

const handleKycNext = async () => {
    loading = true;
    error = null;
    try {
        await globalState.walletSdkAdapter.ensureKey(KEY_ID, "onboarding");

        const { data } = await axios.post(
            new URL("/verification", PUBLIC_PROVISIONER_URL).toString(),
            {},
            {
                headers: {
                    "x-shared-secret": PUBLIC_PROVISIONER_SHARED_SECRET,
                },
            },
        );
        console.log("[Didit] session response:", data);

        if (!data.verificationUrl) {
            throw new Error(
                `Backend did not return a verificationUrl. Response: ${JSON.stringify(data)}`,
            );
        }

        diditLocalId = data.id;
        diditSessionId = data.sessionToken; // store token; actual Didit sessionId comes from onComplete
        loading = false;
        step = "didit-verification";

        // Wait a tick for the container to mount
        await new Promise((r) => setTimeout(r, 50));

        const { DiditSdk } = await import("@didit-protocol/sdk-web");
        const sdk = DiditSdk.shared;
        sdk.onComplete = handleDiditComplete;
        await sdk.startVerification({
            url: data.verificationUrl,
            configuration: {
                embedded: true,
                embeddedContainerId: "didit-container",
            },
        });
    } catch (err) {
        console.error("Failed to start KYC:", err);
        error =
            err instanceof Error
                ? err.message
                : "Failed to start verification. Please try again.";
        loading = false;
        setTimeout(() => {
            error = null;
        }, 6000);
    }
};

const handleDiditComplete = async (result: DiditCompleteResult) => {
    console.log("[Didit] onComplete:", result);

    if (result.type === "cancelled") {
        step = "kyc-panel";
        return;
    }

    if (!result.session?.sessionId) {
        error = "Verification did not return a session ID.";
        step = "kyc-panel";
        return;
    }

    diditActualSessionId = result.session.sessionId;
    step = "loading";

    try {
        const { data: decision } = await axios.get<DiditDecision>(
            new URL(
                `/verification/decision/${result.session.sessionId}`,
                PUBLIC_PROVISIONER_URL,
            ).toString(),
            {
                headers: {
                    "x-shared-secret": PUBLIC_PROVISIONER_SHARED_SECRET,
                },
            },
        );
        console.log("[Didit] decision:", decision);

        diditDecision = decision;
        const rawStatus: string = decision.status ?? "";
        diditResult = rawStatus.toLowerCase().replace(" ", "_") as
            | "approved"
            | "declined"
            | "in_review";

        if (diditResult !== "approved") {
            diditRejectionReason =
                decision.reviews?.[0]?.comment ??
                decision.id_verifications?.[0]?.warnings?.[0]
                    ?.short_description ??
                "Verification could not be completed.";
        }

        step = "verif-result";
    } catch (err) {
        console.error("Failed to fetch Didit decision:", err);
        error = "Failed to retrieve verification result. Please try again.";
        step = "kyc-panel";
        setTimeout(() => {
            error = null;
        }, 6000);
    }
};

const handleProvision = async () => {
    if (!diditDecision || !diditLocalId) return;

    const idVerif = diditDecision.id_verifications?.[0];
    const fullName =
        idVerif?.full_name ??
        `${idVerif?.first_name ?? ""} ${idVerif?.last_name ?? ""}`.trim();
    const dob = idVerif?.date_of_birth ?? "";
    const docType = idVerif?.document_type ?? "";
    const docNumber = idVerif?.document_number ?? "";
    const country = idVerif?.issuing_state_name ?? idVerif?.issuing_state ?? "";
    const expiryDate = idVerif?.expiration_date ?? "";
    const issueDate = idVerif?.date_of_issue ?? "";

    globalState.userController.user = {
        name: capitalize(fullName),
        "Date of Birth": dob ? new Date(dob).toDateString() : "",
        "ID submitted":
            [docType, country].filter(Boolean).join(" - ") || "Verified",
        "Document Number": docNumber,
    };
    globalState.userController.document = {
        "Valid From": issueDate ? new Date(issueDate).toDateString() : "",
        "Valid Until": expiryDate ? new Date(expiryDate).toDateString() : "",
        "Verified On": new Date().toDateString(),
    };
    globalState.userController.isFake = false;

    step = "loading";

    try {
        const result = await provision(globalState.walletSdkAdapter, {
            registryUrl: PUBLIC_REGISTRY_URL,
            provisionerUrl: PUBLIC_PROVISIONER_URL,
            namespace: uuidv4(),
            verificationId: diditLocalId,
            keyId: KEY_ID,
            context: "onboarding",
            isPreVerification: false,
        });

        if (result.duplicate) {
            error =
                "An eVault already exists for this identity. You cannot create a duplicate — please reclaim your existing eVault instead.";
            step = "verif-result";
            return;
        }

        if (!result.success) {
            throw new Error("Provisioning failed");
        }
        if (!result.uri || !result.w3id) {
            throw new Error(
                "Provisioning succeeded but did not return uri/w3id",
            );
        }

        globalState.vaultController.vault = {
            uri: result.uri,
            ename: result.w3id,
        };
        goto("/register");
    } catch (err) {
        console.error("Provisioning failed:", err);
        error =
            err instanceof Error
                ? err.message
                : "Something went wrong. Please try again.";
        step = "verif-result";
        setTimeout(() => {
            error = null;
        }, 6000);
    }
};

// ── Anonymous path ────────────────────────────────────────────────────────────

const handleAnonymousSubmit = async () => {
    if (!anonName.trim()) {
        error = "Please enter your name.";
        setTimeout(() => {
            error = null;
        }, 4000);
        return;
    }

    step = "loading";
    error = null;

    try {
        globalState.userController.isFake = true;
        await globalState.walletSdkAdapter.ensureKey(KEY_ID, "onboarding");

        const provisionResult = await provision(globalState.walletSdkAdapter, {
            registryUrl: PUBLIC_REGISTRY_URL,
            provisionerUrl: PUBLIC_PROVISIONER_URL,
            namespace: uuidv4(),
            verificationId: ANONYMOUS_VERIFICATION_CODE,
            keyId: KEY_ID,
            context: "onboarding",
            isPreVerification: true,
        });

        if (provisionResult.duplicate) {
            throw new Error(
                "An eVault already exists for this identity. You cannot create a duplicate — please reclaim your existing eVault instead.",
            );
        }
        if (!provisionResult.success) {
            throw new Error("Anonymous provisioning failed");
        }
        if (!provisionResult.w3id || !provisionResult.uri) {
            console.error(
                "[Onboarding] Missing w3id/uri from anonymous provision result:",
                provisionResult,
            );
            error = "Provisioning response is incomplete. Please try again.";
            step = "anonymous-form";
            return;
        }

        const ename = provisionResult.w3id;
        const uri = provisionResult.uri;

        // Resolve eVault GraphQL endpoint from registry
        const resolveResp = await axios.get(
            new URL(`resolve?w3id=${ename}`, PUBLIC_REGISTRY_URL).toString(),
        );
        const evaultUri = resolveResp.data.uri as string;
        const graphqlEndpoint = new URL("/graphql", evaultUri).toString();

        const timestamp = new Date().toISOString();
        const subject = ename.startsWith("@") ? ename : `@${ename}`;
        const bindingData = { kind: "self", name: anonName.trim() };
        const signature = computeBindingDocumentHash({
            subject,
            type: "self",
            data: bindingData,
        });

        const gqlClient = new GraphQLClient(graphqlEndpoint, {
            headers: {
                "X-ENAME": ename,
                ...(PUBLIC_EID_WALLET_TOKEN
                    ? { Authorization: `Bearer ${PUBLIC_EID_WALLET_TOKEN}` }
                    : {}),
            },
        });

        const bdResult = await gqlClient.request<{
            createBindingDocument: {
                metaEnvelopeId: string | null;
                errors: { message: string; code: string }[] | null;
            };
        }>(
            `mutation CreateBindingDocument($input: CreateBindingDocumentInput!) {
                createBindingDocument(input: $input) {
                    metaEnvelopeId
                    errors { message code }
                }
            }`,
            {
                input: {
                    subject,
                    type: "self",
                    data: bindingData,
                    ownerSignature: {
                        signer: subject,
                        signature,
                        timestamp,
                    },
                },
            },
        );

        const bdErrors = bdResult.createBindingDocument.errors;
        if (bdErrors?.length) {
            throw new Error(`Binding document error: ${bdErrors[0].message}`);
        }

        const tenYearsLater = new Date();
        tenYearsLater.setFullYear(tenYearsLater.getFullYear() + 10);
        globalState.userController.user = {
            name: anonName.trim(),
            "Date of Birth": anonDob ? new Date(anonDob).toDateString() : "",
            "ID submitted": "Anonymous — Self Declaration",
            "Passport Number": generatePassportNumber(),
        };
        globalState.userController.document = {
            "Valid From": new Date().toDateString(),
            "Valid Until": tenYearsLater.toDateString(),
            "Verified On": new Date().toDateString(),
        };

        globalState.vaultController.vault = { uri, ename };
        goto("/register");
    } catch (err) {
        console.error("Anonymous provisioning failed:", err);
        error = "Something went wrong. Please try again.";
        step = "anonymous-form";
        setTimeout(() => {
            error = null;
        }, 6000);
    }
};

const handleUpgrade = async () => {
    if (!diditDecision) return;
    const vault = await globalState.vaultController.vault;
    const w3id = vault?.ename;
    if (!w3id) {
        error = "No active eVault found for upgrade.";
        return;
    }

    const sessionId =
        diditActualSessionId ??
        diditDecision.session_id ??
        diditDecision.session?.sessionId;
    if (!sessionId) {
        error = "Missing session ID from verification result.";
        return;
    }

    step = "loading";
    try {
        const { data } = await axios.post(
            new URL("/verification/upgrade", PUBLIC_PROVISIONER_URL).toString(),
            { diditSessionId: sessionId, w3id },
            {
                headers: {
                    "x-shared-secret": PUBLIC_PROVISIONER_SHARED_SECRET,
                },
            },
        );
        if (!data.success) {
            throw new Error(data.message ?? "Upgrade failed");
        }
        goto("/ePassport");
    } catch (err) {
        console.error("[Upgrade] failed:", err);
        error =
            err instanceof Error
                ? err.message
                : "Upgrade failed. Please try again.";
        step = "verif-result";
        setTimeout(() => {
            error = null;
        }, 6000);
    }
};

// ── eName + passphrase recovery ───────────────────────────────────────────────

// bindingDocuments returns MetaEnvelopeConnection; the BindingDocument shape
// lives inside the `parsed` JSON field as { subject, type, data, signatures }.
interface BindingDocParsed {
    type: string;
    data: Record<string, string>;
    subject: string;
}

interface BindingDocsResult {
    bindingDocuments: {
        edges: Array<{ node: { parsed: BindingDocParsed } }>;
    };
}

const BINDING_DOCS_QUERY = `
    query {
        bindingDocuments(first: 20) {
            edges {
                node {
                    parsed
                }
            }
        }
    }
`;

const handleEnamePassphraseRecovery = async () => {
    enameError = null;

    const ename = enameInput.trim();
    if (!ename) {
        enameError = "Please enter your eName.";
        return;
    }
    if (!enamePassphraseInput) {
        enameError = "Please enter your recovery passphrase.";
        return;
    }

    enameLoading = true;
    step = "loading";

    try {
        // 1. Resolve eName → eVault base URI
        const resolveRes = await axios.get(
            new URL(
                `resolve?w3id=${encodeURIComponent(ename)}`,
                PUBLIC_REGISTRY_URL,
            ).toString(),
        );
        const evaultBase: string = resolveRes.data.uri;
        if (!evaultBase)
            throw new Error("Could not resolve eName to an eVault.");

        // 2. Compare passphrase (IP rate-limited endpoint on the eVault)
        let cmpRes: { data: { match: boolean; hasPassphrase: boolean } };
        try {
            cmpRes = await axios.post(
                new URL("/passphrase/compare", evaultBase).toString(),
                { eName: ename, passphrase: enamePassphraseInput },
            );
        } catch (err: unknown) {
            if (axios.isAxiosError(err) && err.response?.status === 429) {
                const retryAfter =
                    err.response.data?.retryAfterSeconds ?? "a while";
                enameError = `Too many attempts. Please wait ${retryAfter} seconds before trying again.`;
            } else {
                enameError = "Failed to verify passphrase. Please try again.";
            }
            step = "ename-passphrase";
            return;
        }

        if (!cmpRes.data.hasPassphrase) {
            step = "ename-passphrase";
            showNotaryDrawer = true;
            return;
        }
        if (!cmpRes.data.match) {
            enameError = "Incorrect passphrase. Please try again.";
            step = "ename-passphrase";
            return;
        }

        // 3. Fetch binding documents from eVault GraphQL
        const gqlEndpoint = new URL("/graphql", evaultBase).toString();
        const gqlClient = new GraphQLClient(gqlEndpoint, {
            headers: {
                "X-ENAME": ename,
                ...(PUBLIC_EID_WALLET_TOKEN
                    ? { Authorization: `Bearer ${PUBLIC_EID_WALLET_TOKEN}` }
                    : {}),
            },
        });
        const bdRes =
            await gqlClient.request<BindingDocsResult>(BINDING_DOCS_QUERY);
        const parsedDocs = bdRes.bindingDocuments.edges.map(
            (e) => e.node.parsed,
        );

        const selfDoc = parsedDocs.find((n) => n.type === "self");
        const idDoc = parsedDocs.find((n) => n.type === "id_document");

        // 4a. ID-verified path: re-fetch the original Didit decision via provisioner
        if (idDoc?.data?.reference) {
            const { data: decision } = await axios.get(
                new URL(
                    `/verification/decision/${idDoc.data.reference}`,
                    PUBLIC_PROVISIONER_URL,
                ).toString(),
                {
                    headers: {
                        "x-shared-secret": PUBLIC_PROVISIONER_SHARED_SECRET,
                    },
                },
            );

            const iv = decision?.id_verifications?.[0];
            const fullName =
                iv?.full_name ??
                [iv?.first_name, iv?.last_name].filter(Boolean).join(" ") ??
                idDoc.data.name ??
                "";
            const dob = iv?.date_of_birth ?? "";
            const docType = iv?.document_type ?? "";
            const docNumber = iv?.document_number ?? "";
            const country = iv?.issuing_state_name ?? iv?.issuing_state ?? "";
            const expiryDate = iv?.expiration_date ?? "";
            const issueDate = iv?.date_of_issue ?? "";

            // Exact same shape as recoverVault() in /recover/+page.svelte
            const user: Record<string, string> = {
                name: capitalize(fullName),
                "Date of Birth": dob ? new Date(dob).toDateString() : "",
                "ID submitted":
                    [docType, country].filter(Boolean).join(" - ") ||
                    "Verified",
                "Document Number": docNumber,
            };
            const document: Record<string, string> = {
                "Valid From": issueDate
                    ? new Date(issueDate).toDateString()
                    : "",
                "Valid Until": expiryDate
                    ? new Date(expiryDate).toDateString()
                    : "",
                "Verified On": new Date().toDateString(),
            };

            pendingRecovery.set({ uri: evaultBase, ename, user, document });
            goto("/register");
            return;
        }

        // 4b. Self-declaration-only path (anonymous eVault)
        const name = selfDoc?.data?.name ?? ename;
        const user: Record<string, string> = {
            name: capitalize(name),
            "Date of Birth": "",
            "ID submitted": "Anonymous — Self Declaration",
            "Document Number": "",
        };
        const document: Record<string, string> = {
            "Valid From": "",
            "Valid Until": "",
            "Verified On": new Date().toDateString(),
        };

        pendingRecovery.set({ uri: evaultBase, ename, user, document });
        goto("/register");
    } catch (err: unknown) {
        console.error("[RECOVERY/ename-passphrase] error:", err);
        enameError =
            err instanceof Error
                ? err.message
                : "Something went wrong. Please try again.";
        step = "ename-passphrase";
    } finally {
        enameLoading = false;
    }
};

onMount(() => {
    // Detect upgrade mode from query param
    const url = new URL(window.location.href);
    if (url.searchParams.get("upgrade") === "1") {
        upgradeMode = true;
        step = "kyc-panel";
        // Trigger hardware check immediately
        handleIdentityPath();
    }
});
</script>

<main
    class="h-full pt-[4svh] px-[5vw] pb-[4.5svh] flex flex-col justify-between"
>
    <article class="flex justify-center mb-4">
        <img
            class="w-[88vw] h-[39svh]"
            src="/images/Onboarding.svg"
            alt="Infographic card"
        />
    </article>

    <!-- ── Screen 1: home ─────────────────────────────────────────────────── -->
    {#if step === "home"}
        <section>
            <Hero class="mb-4" titleClasses="text-[42px]/[1.1] font-medium">
                {#snippet subtitle()}
                    Your Digital Self consists of three core elements: <br />
                    <strong>eName</strong> – your digital identifier, a number
                    <br />
                    <strong>ePassport</strong> – your cryptographic keys,
                    enabling your agency and control
                    <br />
                    <strong>eVault</strong> – the secure repository of all your
                    personal data. You will decide who can access it, and how.
                    <br />
                {/snippet}
                Your Digital Self<br />
                <h4>in Web 3.0 Data Space</h4>
            </Hero>
        </section>
        <section>
            <div class="flex flex-col gap-3 mt-3">
                <ButtonAction
                    class="w-full"
                    callback={() => {
                        step = "new-evault";
                    }}
                >
                    Make a new eVault
                </ButtonAction>
                <ButtonAction
                    variant="soft"
                    class="w-full"
                    callback={() => {
                        step = "already-have";
                    }}
                >
                    Already have an eVault
                </ButtonAction>
            </div>
            <p class="text-center small mt-4 text-black-500">
                By continuing you agree to our <br />
                <a
                    href="https://metastate.foundation/"
                    rel="noopener noreferrer"
                    class="text-primary underline underline-offset-4"
                    target="_blank">Terms & Conditions</a
                >
                and
                <a
                    href="https://metastate.foundation/"
                    rel="noopener noreferrer"
                    target="_blank"
                    class="text-primary underline underline-offset-4"
                    >Privacy Policy.</a
                >
            </p>
        </section>

        <!-- ── Screen: already have ────────────────────────────────────────── -->
    {:else if step === "already-have"}
        <section class="grow flex flex-col justify-center gap-6">
            <div>
                <h4 class="text-xl font-bold mb-1">Already have an eVault?</h4>
                <p class="text-black-700 text-sm">
                    Were you identity-verified when you set up your eVault?
                </p>
            </div>
            <div class="flex flex-col gap-3">
                <button
                    onclick={() => goto("/recover")}
                    class="w-full rounded-2xl border border-gray-200 bg-gray-50 p-5 text-left hover:bg-gray-100 transition-colors active:bg-gray-200"
                >
                    <p class="font-semibold text-base mb-1">Yes, I verified my ID</p>
                    <p class="text-sm text-black-500">
                        We'll use your verified identity to find and confirm your previous eVault.
                    </p>
                </button>
                <button
                    onclick={() => { step = "ename-recovery"; enameError = null; }}
                    class="w-full rounded-2xl border border-gray-200 bg-gray-50 p-5 text-left hover:bg-gray-100 transition-colors active:bg-gray-200"
                >
                    <p class="font-semibold text-base mb-1">No, I didn't verify my ID</p>
                    <p class="text-sm text-black-500">
                        Recover using your eName and recovery passphrase, or get help from a W3DS Notary.
                    </p>
                </button>
            </div>
        </section>
        <ButtonAction
            variant="soft"
            class="w-full mt-4"
            callback={() => { step = "home"; }}
        >
            Back
        </ButtonAction>

        <!-- ── Screen 2: new-evault ───────────────────────────────────────────── -->
    {:else if step === "new-evault"}
        <section class="grow flex flex-col justify-center gap-6">
            <div>
                <h4 class="text-xl font-bold mb-1">Create a new eVault</h4>
                <p class="text-black-700 text-sm">
                    Choose how you want to establish your digital identity.
                </p>
            </div>
            <div class="flex flex-col gap-3">
                <button
                    onclick={handleIdentityPath}
                    class="w-full rounded-2xl border border-gray-200 bg-gray-50 p-5 text-left hover:bg-gray-100 transition-colors active:bg-gray-200"
                >
                    <p class="font-semibold text-base mb-1">
                        Linked to your identity
                    </p>
                    <p class="text-sm text-black-500">
                        Verify your real-world passport. Your eVault will be
                        cryptographically bound to your identity document.
                    </p>
                </button>
                <button
                    onclick={() => {
                        step = "anonymous-form";
                    }}
                    class="w-full rounded-2xl border border-gray-200 bg-gray-50 p-5 text-left hover:bg-gray-100 transition-colors active:bg-gray-200"
                >
                    <p class="font-semibold text-base mb-1">Anonymously</p>
                    <p class="text-sm text-black-500">
                        Self-declare your name. No ID document required. A
                        self-signed binding document will be created.
                    </p>
                </button>
            </div>
        </section>
        <ButtonAction
            variant="soft"
            class="w-full mt-4"
            callback={() => {
                step = "home";
            }}
        >
            Back
        </ButtonAction>

        <!-- ── Screen: anonymous form ─────────────────────────────────────────── -->
    {:else if step === "anonymous-form"}
        <section class="grow flex flex-col justify-start gap-4 pt-2">
            <div>
                <h4 class="text-xl font-bold mb-1">
                    Self-declare your identity
                </h4>
                <p class="text-black-700 text-sm">
                    You are creating a self-signed binding document that
                    certifies your name. No ID verification is required.
                </p>
            </div>

            {#if error}
                <div
                    class="bg-[#ff3300] rounded-md p-2 w-full text-center text-white text-sm"
                >
                    {error}
                </div>
            {/if}

            <div class="flex flex-col gap-1">
                <label
                    class="text-black-700 font-medium text-sm"
                    for="anonName"
                >
                    Your Name <span class="text-danger">*</span>
                </label>
                <input
                    id="anonName"
                    type="text"
                    bind:value={anonName}
                    class="border border-gray-200 w-full rounded-md font-medium my-1 p-3 bg-gray-50 focus:bg-white transition-colors"
                    placeholder="Enter your full name"
                />
            </div>

            <div class="flex flex-col gap-1">
                <label class="text-black-700 font-medium text-sm" for="anonDob">
                    Date of Birth
                    <span class="text-black-400 font-normal">(optional)</span>
                </label>
                <input
                    id="anonDob"
                    type="date"
                    bind:value={anonDob}
                    class="border border-gray-200 w-full rounded-md font-medium my-1 p-3 bg-gray-50 focus:bg-white transition-colors"
                />
                <p class="text-xs text-black-400">
                    Stored on your device only — not included in your binding
                    document.
                </p>
            </div>

            <div class="rounded-xl bg-primary-50 border border-primary-100 p-4">
                <p class="text-xs text-primary-700 leading-relaxed">
                    By continuing, I declare that the name I have provided is my
                    own and that I am the sole owner of this eVault. This
                    declaration will be cryptographically signed and stored as a
                    self-certification binding document.
                </p>
            </div>
        </section>

        <div class="flex flex-col gap-3 pt-4 pb-12">
            <ButtonAction
                variant={anonName.trim().length === 0 ? "soft" : "solid"}
                disabled={anonName.trim().length === 0}
                class="w-full"
                callback={handleAnonymousSubmit}
            >
                Confirm & Create
            </ButtonAction>
            <ButtonAction
                variant="soft"
                class="w-full"
                callback={() => {
                    step = "new-evault";
                    error = null;
                }}
            >
                Back
            </ButtonAction>
        </div>

        <!-- ── Screen: eName recovery — do you remember your eName? ─────────── -->
    {:else if step === "ename-recovery"}
        <section class="grow flex flex-col justify-center gap-6">
            <div>
                <h4 class="text-xl font-bold mb-1">Recover with eName</h4>
                <p class="text-black-700 text-sm">
                    Do you remember your eName?
                </p>
            </div>
            <div class="flex flex-col gap-3">
                <button
                    onclick={() => { step = "ename-passphrase-check"; enameError = null; }}
                    class="w-full rounded-2xl border border-gray-200 bg-gray-50 p-5 text-left hover:bg-gray-100 transition-colors active:bg-gray-200"
                >
                    <p class="font-semibold text-base mb-1">Yes, I remember my eName</p>
                    <p class="text-sm text-black-500">
                        Continue to verify with your recovery passphrase.
                    </p>
                </button>
                <button
                    onclick={() => { showEnameDeadEndDrawer = true; }}
                    class="w-full rounded-2xl border border-gray-200 bg-gray-50 p-5 text-left hover:bg-gray-100 transition-colors active:bg-gray-200"
                >
                    <p class="font-semibold text-base mb-1">No, I don't remember my eName</p>
                    <p class="text-sm text-black-500">
                        Without your eName or ID verification, recovery is not possible.
                    </p>
                </button>
            </div>
        </section>
        <ButtonAction
            variant="soft"
            class="w-full mt-4"
            callback={() => { step = "already-have"; }}
        >
            Back
        </ButtonAction>

        <!-- ── Screen: passphrase check — do you remember your passphrase? ──── -->
    {:else if step === "ename-passphrase-check"}
        <section class="grow flex flex-col justify-center gap-6">
            <div>
                <h4 class="text-xl font-bold mb-1">Recovery Passphrase</h4>
                <p class="text-black-700 text-sm">
                    Do you remember your recovery passphrase?
                </p>
            </div>
            <div class="flex flex-col gap-3">
                <button
                    onclick={() => { step = "ename-passphrase"; enameError = null; }}
                    class="w-full rounded-2xl border border-gray-200 bg-gray-50 p-5 text-left hover:bg-gray-100 transition-colors active:bg-gray-200"
                >
                    <p class="font-semibold text-base mb-1">Yes, I remember my passphrase</p>
                    <p class="text-sm text-black-500">
                        Enter your eName and passphrase to restore your eVault.
                    </p>
                </button>
                <button
                    onclick={() => { showNotaryDrawer = true; }}
                    class="w-full rounded-2xl border border-gray-200 bg-gray-50 p-5 text-left hover:bg-gray-100 transition-colors active:bg-gray-200"
                >
                    <p class="font-semibold text-base mb-1">I don't remember my passphrase</p>
                    <p class="text-sm text-black-500">
                        You can visit a Registered W3DS Notary who can verify your identity
                        and help recover your eVault using trusted witnesses or other proofs of ownership.
                    </p>
                </button>
            </div>
        </section>
        <ButtonAction
            variant="soft"
            class="w-full mt-4"
            callback={() => { step = "ename-recovery"; }}
        >
            Back
        </ButtonAction>

        <!-- ── Screen: eName + passphrase form ───────────────────────────────── -->
    {:else if step === "ename-passphrase"}
        <section class="grow flex flex-col justify-start gap-4 pt-2">
            <div>
                <h4 class="text-xl font-bold mb-1">Enter your eName &amp; Passphrase</h4>
                <p class="text-black-700 text-sm">
                    Your recovery passphrase was set in the eVault Settings. Both your eName and passphrase must match.
                </p>
            </div>

            {#if enameError}
                <div class="bg-[#ff3300] rounded-md p-2 w-full text-center text-white text-sm">
                    {enameError}
                </div>
            {/if}

            <div class="flex flex-col gap-1">
                <label class="text-black-700 font-medium text-sm" for="enameInput">
                    Your eName <span class="text-danger">*</span>
                </label>
                <input
                    id="enameInput"
                    type="text"
                    bind:value={enameInput}
                    autocomplete="username"
                    class="border border-gray-200 w-full rounded-md font-medium my-1 p-3 bg-gray-50 focus:bg-white transition-colors"
                    placeholder="e.g. @4f2a9c1b-…"
                />
            </div>

            <div class="flex flex-col gap-1">
                <label class="text-black-700 font-medium text-sm" for="enamePassphraseInput">
                    Recovery Passphrase <span class="text-danger">*</span>
                </label>
                <input
                    id="enamePassphraseInput"
                    type="password"
                    bind:value={enamePassphraseInput}
                    autocomplete="current-password"
                    class="border border-gray-200 w-full rounded-md font-medium my-1 p-3 bg-gray-50 focus:bg-white transition-colors"
                    placeholder="Enter your recovery passphrase"
                />
            </div>
        </section>

        <div class="flex flex-col gap-3 pt-4 pb-12">
            <ButtonAction
                variant={enameInput.trim() && enamePassphraseInput ? "solid" : "soft"}
                disabled={!enameInput.trim() || !enamePassphraseInput}
                class="w-full"
                callback={handleEnamePassphraseRecovery}
            >
                Recover eVault
            </ButtonAction>
            <ButtonAction
                variant="soft"
                class="w-full"
                callback={() => { step = "ename-passphrase-check"; enameError = null; }}
            >
                Back
            </ButtonAction>
        </div>

        <!-- ── Screen: loading ────────────────────────────────────────────────── -->
    {:else if step === "loading"}
        <section class="grow flex flex-col items-center justify-center gap-6">
            <Shadow size={40} color="rgb(142, 82, 255)" />
            <h4 class="text-center">Generating your eName</h4>
            <p class="text-center text-black-500 text-sm">
                Creating your eVault and signing your binding document…
            </p>
        </section>
    {/if}
</main>

<!-- ── KYC / Identity full-screen overlay ──────────────────────────────────── -->
{#if step === "kyc-panel"}
    <div class="fixed inset-0 z-50 bg-white overflow-y-auto">
        <div
            class="min-h-full flex flex-col p-6"
            style="padding-top: max(24px, env(safe-area-inset-top));"
        >
            <article class="grow flex flex-col items-start w-full">
                <img
                    src="/images/GetStarted.svg"
                    alt="get-started"
                    class="w-full mb-4"
                />

                {#if error}
                    <div
                        class="bg-[#ff3300] rounded-md p-2 w-full text-center text-white mb-4"
                    >
                        {error}
                    </div>
                {/if}

                {#if loading}
                    <div
                        class="w-full py-20 flex flex-col items-center justify-center gap-6"
                    >
                        <Shadow size={40} color="rgb(142, 82, 255)" />
                        <h4 class="text-center">Starting verification…</h4>
                    </div>
                {:else if checkingHardware}
                    <div
                        class="w-full py-20 flex flex-col items-center justify-center gap-6"
                    >
                        <Shadow size={40} color="rgb(142, 82, 255)" />
                        <h4 class="text-center">
                            Checking device capabilities...
                        </h4>
                    </div>
                {:else if showHardwareError}
                    <h4 class="mt-2 mb-2 text-red-600 text-left">
                        Hardware Security Not Available
                    </h4>
                    <p class="text-black-700 mb-4">
                        Your phone doesn't support hardware crypto keys, which
                        is a requirement for verified IDs.
                    </p>
                    <p class="text-black-700">
                        Please use the anonymous option to create an eVault
                        instead.
                    </p>
                {:else}
                    <h4 class="mt-2 mb-4 text-left">
                        Your Digital Self begins with the Real You
                    </h4>
                    <p class="text-black-700 leading-relaxed">
                        In the Web 3.0 Data Space, identity is linked to
                        reality. We begin by verifying your real-world passport,
                        which serves as the foundation for issuing your secure
                        ePassport. At the same time, we generate your eName – a
                        unique digital identifier – and create your eVault to
                        store and protect your personal data.
                    </p>
                {/if}
            </article>

            <div class="flex-none pt-8 pb-12">
                {#if !loading && !checkingHardware}
                    <div class="flex flex-col w-full gap-3">
                        {#if showHardwareError}
                            <ButtonAction
                                class="w-full"
                                callback={() => {
                                    step = "anonymous-form";
                                    error = null;
                                }}
                            >
                                Go Anonymous
                            </ButtonAction>
                        {:else}
                            <ButtonAction
                                class="w-full"
                                callback={handleKycNext}
                            >
                                Next
                            </ButtonAction>
                        {/if}
                        <ButtonAction
                            variant="soft"
                            class="w-full"
                            callback={() => {
                                if (upgradeMode) {
                                    goto("/ePassport");
                                } else {
                                    step = "new-evault";
                                    error = null;
                                }
                            }}
                        >
                            Back
                        </ButtonAction>
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}

<!-- ── Didit embedded verification ─────────────────────────────────────────── -->
{#if step === "didit-verification"}
    <div
        class="fixed inset-0 z-50 bg-white flex flex-col"
        style="padding-top: max(16px, env(safe-area-inset-top)); padding-bottom: max(24px, env(safe-area-inset-bottom));"
    >
        <div class="flex-none flex justify-end px-4 pt-2">
            <button
                class="text-sm text-black-500 underline"
                onclick={() => {
                    if (upgradeMode) {
                        goto("/ePassport");
                    } else {
                        step = "kyc-panel";
                    }
                }}
            >
                Cancel
            </button>
        </div>
        <div id="didit-container" class="flex-1 w-full"></div>
    </div>
{/if}

<!-- ── Verification result bottom sheet ────────────────────────────────────── -->
{#if step === "verif-result"}
    <div class="fixed inset-0 z-40 bg-black/40" aria-hidden="true"></div>
    <div
        class="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-xl flex flex-col gap-4"
        style="padding: 1.5rem 1.5rem max(1.5rem, env(safe-area-inset-bottom));"
    >
        {#if error}
            <div
                class="bg-[#ff3300] rounded-md p-2 w-full text-center text-white text-sm"
            >
                {error}
            </div>
        {/if}

        {#if diditResult === "approved"}
            <div class="flex items-center gap-3">
                <div
                    class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-lg font-bold"
                >
                    ✓
                </div>
                <h3 class="text-lg font-bold">Identity Verified</h3>
            </div>
            <p class="text-black-700 text-sm">
                {upgradeMode
                    ? "Your identity has been verified. Your eVault trust level will now be upgraded."
                    : "Your identity has been successfully verified. You can now create your eVault."}
            </p>
            <div class="flex flex-col gap-3 pt-2">
                <ButtonAction class="w-full" callback={upgradeMode ? handleUpgrade : handleProvision}>
                    Continue
                </ButtonAction>
            </div>
        {:else if diditResult === "in_review"}
            <div class="flex items-center gap-3">
                <div
                    class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-lg font-bold"
                >
                    ⏳
                </div>
                <h3 class="text-lg font-bold">Under Review</h3>
            </div>
            <p class="text-black-700 text-sm">
                Your verification is being manually reviewed. You'll be notified
                when it's complete.
            </p>
            <div class="flex flex-col gap-3 pt-2">
                <ButtonAction
                    variant="soft"
                    class="w-full"
                    callback={() => {
                        if (upgradeMode) goto("/ePassport");
                        else step = "home";
                    }}
                >
                    {upgradeMode ? "Back to ePassport" : "Back to Start"}
                </ButtonAction>
            </div>
        {:else}
            <div class="flex items-center gap-3">
                <div
                    class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-lg font-bold"
                >
                    ✗
                </div>
                <h3 class="text-lg font-bold">Verification Failed</h3>
            </div>
            <p class="text-black-700 text-sm">
                {diditRejectionReason ??
                    "Your verification could not be completed."}
            </p>
            <div class="flex flex-col gap-3 pt-2">
                <ButtonAction class="w-full" callback={handleKycNext}>
                    Try Again
                </ButtonAction>
                <ButtonAction
                    variant="soft"
                    class="w-full"
                    callback={() => {
                        if (upgradeMode) goto("/ePassport");
                        else step = "home";
                    }}
                >
                    Back
                </ButtonAction>
            </div>
        {/if}
    </div>
{/if}

<!-- ── eName dead-end — no eName remembered ──────────────────────────────── -->
{#if showEnameDeadEndDrawer}
    <div class="fixed inset-0 z-40 bg-black/40" aria-hidden="true"></div>
    <div
        class="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-xl flex flex-col gap-4"
        style="padding: 1.5rem 1.5rem max(1.5rem, env(safe-area-inset-bottom));"
    >
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-lg font-bold">✗</div>
            <h3 class="text-lg font-bold">Recovery Not Possible</h3>
        </div>
        <p class="text-black-700 text-sm leading-relaxed">
            Without your eName and without ID verification, there is no way to recover your eVault.
            Your eName is your unique identifier — it cannot be looked up without a verified identity.
        </p>
        <p class="text-black-700 text-sm leading-relaxed">
            You will need to create a new eVault instead.
        </p>
        <div class="flex flex-col gap-3 pt-2">
            <ButtonAction class="w-full" callback={() => { showEnameDeadEndDrawer = false; step = "new-evault"; }}>
                Create a new eVault
            </ButtonAction>
            <ButtonAction variant="soft" class="w-full" callback={() => { showEnameDeadEndDrawer = false; }}>
                Back
            </ButtonAction>
        </div>
    </div>
{/if}

<!-- ── Notary required — forgot passphrase or no passphrase set ──────────── -->
{#if showNotaryDrawer}
    <div class="fixed inset-0 z-40 bg-black/40" aria-hidden="true"></div>
    <div
        class="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-xl flex flex-col gap-4"
        style="padding: 1.5rem 1.5rem max(1.5rem, env(safe-area-inset-bottom));"
    >
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-lg font-bold">!</div>
            <h3 class="text-lg font-bold">Visit a W3DS Notary</h3>
        </div>
        <p class="text-black-700 text-sm leading-relaxed">
            Without your recovery passphrase, your eVault cannot be restored automatically.
        </p>
        <p class="text-black-700 text-sm leading-relaxed">
            You can visit a <strong>Registered W3DS Notary</strong> in person. They can verify your identity
            using trusted witnesses, government-issued documents, or other proofs of ownership and
            authorise recovery of your eVault on your behalf.
        </p>
        <div class="flex flex-col gap-3 pt-2">
            <ButtonAction variant="soft" class="w-full" callback={() => { showNotaryDrawer = false; }}>
                Back
            </ButtonAction>
        </div>
    </div>
{/if}
