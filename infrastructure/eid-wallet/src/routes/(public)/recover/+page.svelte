<script lang="ts">
import { goto } from "$app/navigation";
import {
    PUBLIC_EID_WALLET_TOKEN,
    PUBLIC_PROVISIONER_SHARED_SECRET,
    PUBLIC_PROVISIONER_URL,
    PUBLIC_REGISTRY_URL,
} from "$env/static/public";
import { keyboardInset } from "$lib/actions/keyboardInset";
import { pendingRecovery } from "$lib/stores/pendingRecovery";
import { ButtonAction } from "$lib/ui";
import BottomSheet from "$lib/ui/BottomSheet/BottomSheet.svelte";
import LoadingSheet from "$lib/ui/LoadingSheet/LoadingSheet.svelte";
import { capitalize } from "$lib/utils";
import { PERSONAL_BINDING_BY_TYPE_QUERY } from "$lib/utils/personalBinding";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import {
    Format,
    checkPermissions,
    openAppSettings,
    requestPermissions,
    scan,
} from "@tauri-apps/plugin-barcode-scanner";
import axios from "axios";
import { GraphQLClient } from "graphql-request";
import { createLocalJWKSet, decodeJwt, jwtVerify } from "jose";
import { onMount } from "svelte";

/**
 * Unified restore flow.
 *
 * Two top-level paths, picked on the "Restore DigitalSelf" home screen:
 *   1. Verified — Didit face match against an ID-verified eVault.
 *      Existing provisioner endpoints (/recovery/start-session, /recovery/face-search)
 *      are still wired up here.
 *   2. Unverified — type your eName, then answer the security question you
 *      set during the personal-binding flow. We resolve the eName to its
 *      eVault URI via the registry, fetch the security_question binding doc,
 *      and call the eVault's validateSecurityAnswer mutation. The mutation
 *      tracks failed attempts per-eName and locks the caller out after a
 *      configurable threshold.
 */

type Step =
    | "home"
    | "verified-didit"
    | "unverified-ename"
    | "unverified-answer"
    | "notary-scanning"
    | "notary-confirm";

/** Loading overlay phases — rendered as a LoadingSheet on top of whatever
 *  step is active, so the underlying screen stays visible (and blurred). */
type LoadingPhase =
    | "starting-session"
    | "finding-evault"
    | "verifying-notary"
    | null;

type ErrorReason = "liveness_failed" | "no_match" | "generic";

interface DiditCompleteResult {
    type?: string;
    session?: {
        sessionId?: string;
    };
}

let step = $state<Step>("home");
let loadingPhase = $state<LoadingPhase>(null);

const loadingTitle = $derived(
    loadingPhase === "starting-session"
        ? "Preparing verification"
        : loadingPhase === "finding-evault"
          ? "Finding your eVault"
          : loadingPhase === "verifying-notary"
            ? "Verifying the notary"
            : "",
);
const loadingSubtitle = $derived(
    loadingPhase === "starting-session"
        ? "Setting up your recovery session."
        : loadingPhase === "finding-evault"
          ? "Looking for an eVault linked to your identity."
          : loadingPhase === "verifying-notary"
            ? "Checking the recovery code's signature against the registry."
            : "",
);

function cancelLoading() {
    loadingPhase = null;
    step = "home";
}

// Verified-path state
let errorMessage = $state<string | null>(null);
let errorReason = $state<ErrorReason>("generic");
let showErrorSheet = $state(false);

let recoveredW3id = $state<string | null>(null);
let recoveredUri = $state<string | null>(null);
let recoveredIdVerif = $state<Record<string, string> | null>(null);
let showFoundSheet = $state(false);
let storing = $state(false);

// Unverified-path state
let enameInput = $state("");
let enameError = $state<string | null>(null);
let enameLoading = $state(false);

let answerInput = $state("");
let answerError = $state<string | null>(null);
let answerLoading = $state(false);

// Question text + envelope id are pulled from the target eVault during
// handleSubmitEname. The envelope id is the metaEnvelopeId of the
// security_question binding document — required to validate the answer.
let securityQuestion = $state<string>("");
let recoveryEnvelopeId = $state<string | null>(null);
let recoveredVaultUri = $state<string | null>(null);
let lockedUntilLabel = $state<string | null>(null);

let showRecoveryImpossibleSheet = $state(false);
let showNotarySheet = $state(false);

// ── Notary-issued recovery (signed-JWT QR) ────────────────────────────
interface NotaryWhitelistEntry {
    ename: string;
    url: string;
    name?: string;
}
interface NotaryRecoveryPayload {
    sessionId: string;
    targetEName: string;
    notaryEName: string;
    claim: string;
}
let notarySessionId = $state<string | null>(null);
let notaryClaimUrl = $state<string | null>(null);
let notaryDisplayName = $state<string | null>(null);
let notaryTargetEName = $state<string | null>(null);
let notaryError = $state<string | null>(null);
let notaryClaiming = $state(false);

async function resolveEvaultBase(w3id: string): Promise<string> {
    const res = await axios.get(
        new URL(
            `resolve?w3id=${encodeURIComponent(w3id)}`,
            PUBLIC_REGISTRY_URL,
        ).toString(),
    );
    return res.data.uri as string;
}

// ── Home ──────────────────────────────────────────────────────────────

function handleHomeBack() {
    goto("/");
}

function handleChooseVerified() {
    startVerifiedRecovery();
}

function handleChooseUnverified() {
    enameInput = "";
    enameError = null;
    step = "unverified-ename";
}

// ── Verified path ─────────────────────────────────────────────────────

async function startVerifiedRecovery() {
    loadingPhase = "starting-session";
    errorMessage = null;
    recoveredW3id = null;
    recoveredUri = null;
    recoveredIdVerif = null;

    try {
        const { data } = await axios.post(
            new URL(
                "/recovery/start-session",
                PUBLIC_PROVISIONER_URL,
            ).toString(),
        );

        if (!data.verificationUrl) {
            throw new Error("Backend did not return a verificationUrl");
        }

        loadingPhase = null;
        step = "verified-didit";
        await new Promise((r) => setTimeout(r, 50));

        const { DiditSdk } = await import("@didit-protocol/sdk-web");
        const sdk = DiditSdk.shared;
        sdk.onComplete = handleDiditComplete;
        await sdk.startVerification({
            url: data.verificationUrl,
            configuration: {
                embedded: true,
                embeddedContainerId: "recovery-didit-container",
            },
        });
    } catch (err: unknown) {
        console.error("[RECOVERY] start-recovery error:", err);
        errorMessage =
            err instanceof Error
                ? err.message
                : "Something went wrong. Please try again.";
        errorReason = "generic";
        loadingPhase = null;
        step = "home";
        showErrorSheet = true;
    }
}

async function handleDiditComplete(result: DiditCompleteResult) {
    if (result.type === "cancelled") {
        step = "home";
        return;
    }

    if (!result.session?.sessionId) {
        errorMessage =
            "The verification session did not return a session ID. Please try again.";
        errorReason = "generic";
        step = "home";
        showErrorSheet = true;
        return;
    }

    step = "home";
    loadingPhase = "finding-evault";

    try {
        const { data } = await axios.post(
            new URL("/recovery/face-search", PUBLIC_PROVISIONER_URL).toString(),
            { diditSessionId: result.session.sessionId },
        );

        if (!data.success) {
            if (data.reason === "liveness_failed") {
                errorMessage =
                    "We couldn't confirm you were a live person. Please try again in good lighting.";
                errorReason = "liveness_failed";
            } else {
                errorMessage =
                    "We couldn't find an eVault linked to your identity. Make sure you completed identity verification when you first set up your eVault.";
                errorReason = "no_match";
            }
            loadingPhase = null;
            step = "home";
            showErrorSheet = true;
            return;
        }

        recoveredW3id = data.w3id;
        recoveredUri = data.uri ?? null;
        recoveredIdVerif = data.idVerif ?? null;
        loadingPhase = null;
        step = "home";
        showFoundSheet = true;
    } catch (err: unknown) {
        console.error("[RECOVERY] face-search error:", err);
        errorMessage =
            "Something went wrong during the search. Please try again.";
        errorReason = "generic";
        loadingPhase = null;
        step = "home";
        showErrorSheet = true;
    }
}

// ── Unverified path ────────────────────────────────────────────────────

function normalizeEname(ename: string): string {
    return ename.startsWith("@") ? ename : `@${ename}`;
}

function makeRecoveryClient(uri: string, ename: string): GraphQLClient {
    const endpoint = new URL("/graphql", uri).toString();
    // The eVault's bindingDocuments query + validateSecurityAnswer mutation
    // both require the shared bearer token (per the access guard). The
    // X-ENAME header tells the resolver which identity to look up.
    const headers: Record<string, string> = {
        "X-ENAME": normalizeEname(ename),
    };
    if (PUBLIC_EID_WALLET_TOKEN) {
        headers.Authorization = `Bearer ${PUBLIC_EID_WALLET_TOKEN}`;
    }
    return new GraphQLClient(endpoint, { headers });
}

interface SecurityQuestionEdge {
    node: {
        id: string;
        parsed: {
            data?: {
                kind?: string;
                question?: string;
                answerHash?: string;
            };
            signatures?: Array<{ timestamp?: string }>;
        };
    };
}

interface SecurityQuestionResponse {
    bindingDocuments: {
        edges: SecurityQuestionEdge[];
    };
}

interface BindingDocsResponse {
    bindingDocuments: {
        edges: Array<{
            node: {
                parsed: {
                    type?: string;
                    data?: Record<string, unknown>;
                };
            };
        }>;
    };
}

const ALL_BINDING_DOCS_QUERY = `
    query AllBindingDocs {
        bindingDocuments(first: 50) {
            edges { node { parsed } }
        }
    }
`;

function asStr(v: unknown): string | undefined {
    return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * After a successful answer validation we still need to populate the user's
 * name + legal-ID details on the recovering device. The verified (Didit) path
 * gets these from /recovery/face-search; the unverified path has to pull them
 * itself from the user's existing eVault bindings + the provisioner.
 *
 * Strategy:
 *  1. Pull all binding documents from the eVault in one round trip.
 *  2. If an id_document exists, build an idVerif-shaped payload from its
 *     `data` directly. If the doc only carries the sparse provisioner
 *     shape `{ vendor, reference, name }`, fall back to GET
 *     /verification/v2/decision/{reference} to retrieve the full Didit
 *     id_verifications[0] just like the verified recovery path receives.
 *  3. If no id_document, return a "self-declared" idVerif using the `self`
 *     binding doc's name as a last resort.
 *
 * Returns null only if neither source produces a usable name — caller falls
 * back to the existing "Anonymous — Self Declaration" placeholder.
 */
async function fetchRecoveryProfile(
    client: GraphQLClient,
): Promise<Record<string, string> | null> {
    let docs: BindingDocsResponse;
    try {
        docs = await client.request<BindingDocsResponse>(
            ALL_BINDING_DOCS_QUERY,
        );
    } catch (err) {
        console.warn("[RECOVERY/unverified] binding-docs fetch failed:", err);
        return null;
    }

    const parsed = (docs.bindingDocuments?.edges ?? [])
        .map((e) => e.node.parsed)
        .filter((p): p is { type: string; data: Record<string, unknown> } =>
            Boolean(p?.type),
        );

    const idDoc = parsed.find((p) => p.type === "id_document");

    if (idDoc) {
        const data = idDoc.data;
        const direct = {
            full_name:
                asStr(data.full_name) ??
                asStr(data.name) ??
                [asStr(data.first_name), asStr(data.last_name)]
                    .filter(Boolean)
                    .join(" "),
            date_of_birth:
                asStr(data.date_of_birth) ?? asStr(data.dateOfBirth) ?? "",
            document_type:
                asStr(data.document_type) ?? asStr(data.documentType) ?? "",
            document_number:
                asStr(data.document_number) ?? asStr(data.documentNumber) ?? "",
            issuing_state_name:
                asStr(data.issuing_state_name) ??
                asStr(data.issuing_country) ??
                "",
            issuing_state: asStr(data.issuing_state) ?? "",
            expiration_date:
                asStr(data.expiration_date) ?? asStr(data.expirationDate) ?? "",
            date_of_issue:
                asStr(data.date_of_issue) ?? asStr(data.dateOfIssue) ?? "",
        };

        // Provisioner currently stores a sparse doc `{ vendor, reference,
        // name }`. If document_type/number etc. are blank, try to enrich
        // via the Didit decision endpoint.
        const isSparse = !direct.document_type && !direct.document_number;
        const reference = asStr(data.reference);
        if (isSparse && reference) {
            try {
                const { data: decision } = await axios.get<{
                    id_verifications?: Array<Record<string, string>>;
                }>(
                    new URL(
                        `/verification/v2/decision/${encodeURIComponent(reference)}`,
                        PUBLIC_PROVISIONER_URL,
                    ).toString(),
                    {
                        headers: {
                            "x-shared-secret": PUBLIC_PROVISIONER_SHARED_SECRET,
                        },
                    },
                );
                const iv = decision.id_verifications?.[0];
                if (iv) {
                    return {
                        full_name: iv.full_name ?? direct.full_name ?? "",
                        first_name: iv.first_name ?? "",
                        last_name: iv.last_name ?? "",
                        date_of_birth: iv.date_of_birth ?? "",
                        document_type: iv.document_type ?? "",
                        document_number: iv.document_number ?? "",
                        issuing_state_name: iv.issuing_state_name ?? "",
                        issuing_state: iv.issuing_state ?? "",
                        expiration_date: iv.expiration_date ?? "",
                        date_of_issue: iv.date_of_issue ?? "",
                    };
                }
            } catch (err) {
                console.warn(
                    "[RECOVERY/unverified] decision lookup failed:",
                    err,
                );
            }
        }

        // Either the doc was rich enough, or the decision fetch failed —
        // either way return whatever we have. Empty strings are fine; the
        // existing recoverVault() handles missing fields.
        if (direct.full_name) {
            return direct;
        }
    }

    const selfDoc = parsed.find((p) => p.type === "self");
    if (selfDoc) {
        const name = asStr(selfDoc.data.name);
        if (name) {
            return {
                full_name: name,
                date_of_birth: "",
                document_type: "Self-Declaration",
                document_number: "",
                issuing_state_name: "",
                issuing_state: "",
                expiration_date: "",
                date_of_issue: "",
            };
        }
    }

    return null;
}

async function handleSubmitEname() {
    const ename = enameInput.trim();
    if (!ename) {
        enameError = "Please enter your eName.";
        return;
    }

    enameError = null;
    enameLoading = true;
    try {
        let uri: string;
        try {
            uri = await resolveEvaultBase(ename);
        } catch (err) {
            console.warn("[RECOVERY/unverified] eName resolve failed:", err);
            enameError = "We couldn't find that eName. Check it and try again.";
            return;
        }

        const client = makeRecoveryClient(uri, ename);

        let resp: SecurityQuestionResponse;
        try {
            resp = await client.request<SecurityQuestionResponse>(
                PERSONAL_BINDING_BY_TYPE_QUERY,
                { type: "security_question" },
            );
        } catch (err) {
            console.error(
                "[RECOVERY/unverified] security_question fetch failed:",
                err,
            );
            enameError =
                "Couldn't reach that eVault. Check your connection and try again.";
            return;
        }

        const edges = resp.bindingDocuments?.edges ?? [];
        if (edges.length === 0) {
            enameError =
                "This eVault has no recovery question set. Recovery isn't possible without ID verification.";
            return;
        }

        // Most-recent wins: every edit creates a new doc, and the older ones
        // are orphans we shouldn't validate against.
        const latest = [...edges].sort((a, b) => {
            const at = a.node.parsed.signatures?.[0]?.timestamp ?? "";
            const bt = b.node.parsed.signatures?.[0]?.timestamp ?? "";
            return bt.localeCompare(at);
        })[0];

        const question = latest?.node.parsed.data?.question ?? "";
        if (!question || !latest?.node.id) {
            enameError =
                "This eVault's recovery question is missing or malformed.";
            return;
        }

        securityQuestion = question;
        recoveryEnvelopeId = latest.node.id;
        recoveredVaultUri = uri;
        answerInput = "";
        answerError = null;
        lockedUntilLabel = null;
        step = "unverified-answer";
    } catch (err: unknown) {
        console.error("[RECOVERY/unverified] eName lookup error:", err);
        enameError = "Something went wrong. Please try again.";
    } finally {
        enameLoading = false;
    }
}

const VALIDATE_SECURITY_ANSWER_MUTATION = `
    mutation ValidateAnswer($input: ValidateSecurityAnswerInput!) {
        validateSecurityAnswer(input: $input) {
            success
            reason
            lockedUntil
            attemptsRemaining
            errors { message code }
        }
    }
`;

interface ValidateAnswerResponse {
    validateSecurityAnswer: {
        success: boolean;
        reason: string | null;
        lockedUntil: string | null;
        attemptsRemaining: number | null;
        errors: Array<{ message: string; code: string }> | null;
    };
}

function formatLockedUntil(iso: string): string {
    try {
        const d = new Date(iso);
        return d.toLocaleString(undefined, {
            hour: "numeric",
            minute: "2-digit",
            day: "numeric",
            month: "short",
        });
    } catch {
        return iso;
    }
}

async function handleSubmitAnswer() {
    const answer = answerInput.trim();
    if (!answer) {
        answerError = "Please enter your answer.";
        return;
    }
    if (!recoveryEnvelopeId || !recoveredVaultUri) {
        answerError = "Please re-enter your eName and try again.";
        step = "unverified-ename";
        return;
    }

    answerError = null;
    answerLoading = true;
    try {
        const ename = enameInput.trim();
        const client = makeRecoveryClient(recoveredVaultUri, ename);
        const resp = await client.request<ValidateAnswerResponse>(
            VALIDATE_SECURITY_ANSWER_MUTATION,
            {
                input: {
                    metaEnvelopeId: recoveryEnvelopeId,
                    candidate: answer,
                },
            },
        );
        const result = resp.validateSecurityAnswer;

        if (result.errors?.length) {
            console.error(
                "[RECOVERY/unverified] validate returned errors:",
                result.errors,
            );
            answerError = "Couldn't verify your answer. Please try again.";
            return;
        }

        if (result.success) {
            recoveredW3id = ename;
            recoveredUri = recoveredVaultUri;
            // Pull whatever name / legal-ID data the eVault already has so
            // the recovered user lands with their real identity populated
            // (verified KYC users get their full Didit fields back; anonymous
            // users get at least their self-declared name). Best-effort —
            // failure leaves recoveredIdVerif null, which the existing
            // recoverVault() fallback turns into "Anonymous — Self
            // Declaration", preserving prior behaviour.
            recoveredIdVerif = await fetchRecoveryProfile(client);
            showFoundSheet = true;
            return;
        }

        if (result.lockedUntil) {
            lockedUntilLabel = formatLockedUntil(result.lockedUntil);
            answerError = `Too many wrong answers. Try again after ${lockedUntilLabel}.`;
            return;
        }

        const left = result.attemptsRemaining;
        answerError =
            typeof left === "number"
                ? `That answer doesn't match. ${left} ${left === 1 ? "try" : "tries"} left.`
                : "That answer doesn't match.";
    } catch (err: unknown) {
        console.error("[RECOVERY/unverified] answer verify error:", err);
        answerError = "Couldn't verify your answer. Please try again.";
    } finally {
        answerLoading = false;
    }
}

// ── Notary path (signed-JWT QR) ───────────────────────────────────────
//
// Trust chain: scan → decode-unverified → registry /notaries whitelist →
// fetch the named notary's JWKS → verify the JWT signature → confirm with
// the user → POST claim. We never trust the claim endpoint's response shape
// for anything load-bearing; the verified JWT payload is the source of
// truth for sessionId + targetEName, and we re-resolve the vault URI from
// the registry independently in fetchRecoveryProfile.

function originOf(url: string): string | null {
    try {
        return new URL(url).origin;
    } catch {
        return null;
    }
}

function handleChooseNotary() {
    notaryError = null;
    void runNotaryRecovery();
}

async function runNotaryRecovery() {
    console.log("[RECOVERY/notary] tap → starting flow");

    // Permission dance first — `scan()` silently no-ops if the camera
    // permission has never been granted on this device, so without this
    // the "I am at a notary" button looks completely dead on first tap.
    let permission: string | null = null;
    try {
        permission = await checkPermissions();
        console.log("[RECOVERY/notary] checkPermissions:", permission);
    } catch (err) {
        console.warn("[RECOVERY/notary] checkPermissions threw:", err);
        permission = null;
    }
    if (
        permission === "prompt" ||
        permission === "denied" ||
        permission === null
    ) {
        try {
            permission = await requestPermissions();
            console.log("[RECOVERY/notary] requestPermissions:", permission);
        } catch (err) {
            console.warn(
                "[RECOVERY/notary] camera permission request failed:",
                err,
            );
            permission = null;
        }
    }
    if (permission !== "granted") {
        errorMessage =
            "We need camera access to scan the recovery code. Open this app in your device's Settings to allow the camera.";
        errorReason = "generic";
        showErrorSheet = true;
        // Best-effort: open the system settings page directly so the user
        // doesn't have to hunt for it.
        try {
            await openAppSettings();
        } catch (err) {
            console.warn("[RECOVERY/notary] openAppSettings failed:", err);
        }
        return;
    }

    // `windowed: true` opens the native camera overlay BEHIND the WebView.
    // For the camera feed to actually appear the WebView body needs to be
    // transparent (the same trick (app)/+layout.svelte uses for /scan-qr).
    // Without this the scan IS happening, but the user sees a white page
    // and assumes the button is broken.
    let scanned: { content?: string } | null = null;
    // Swap the home UI for a crosshair-only scanning step so the buttons
    // and copy don't sit on top of the live camera feed. Body class makes
    // the WebView transparent so the native overlay shows through.
    const previousStep = step;
    step = "notary-scanning";
    if (typeof document !== "undefined") {
        document.body.classList.add("custom-global-style");
    }
    try {
        console.log("[RECOVERY/notary] calling scan()…");
        scanned = await scan({
            formats: [Format.QRCode],
            windowed: true,
        });
        console.log("[RECOVERY/notary] scan returned:", scanned);
    } catch (err) {
        console.warn("[RECOVERY/notary] scan cancelled or failed:", err);
        // Surface the failure instead of silently returning — most often
        // this is the user cancelling, but if it's a plugin/runtime error
        // they should at least see *something*.
        errorMessage =
            err instanceof Error && err.message
                ? `Couldn't open the camera: ${err.message}`
                : "Couldn't open the camera. Please try again.";
        errorReason = "generic";
        showErrorSheet = true;
        step = previousStep;
        return;
    } finally {
        if (typeof document !== "undefined") {
            document.body.classList.remove("custom-global-style");
        }
    }
    const content = scanned?.content?.trim();
    if (!content) {
        step = previousStep;
        return;
    }

    if (!content.startsWith("w3ds://notary-recovery")) {
        errorMessage = "That QR isn't a notary recovery code.";
        errorReason = "generic";
        showErrorSheet = true;
        return;
    }

    // Parse `w3ds://notary-recovery?token=...`. URL() with a custom scheme
    // doesn't reliably expose query params, so split manually.
    const queryStart = content.indexOf("?");
    if (queryStart === -1) {
        errorMessage = "That QR isn't a valid notary recovery code.";
        errorReason = "generic";
        showErrorSheet = true;
        return;
    }
    const params = new URLSearchParams(content.slice(queryStart + 1));
    const token = params.get("token");
    if (!token) {
        errorMessage = "That QR isn't a valid notary recovery code.";
        errorReason = "generic";
        showErrorSheet = true;
        return;
    }

    loadingPhase = "verifying-notary";
    try {
        // 1. Decode unverified to read the declared notary + claim URL.
        let unverified: Partial<NotaryRecoveryPayload>;
        try {
            unverified = decodeJwt(token);
        } catch {
            failNotary("This recovery code is malformed.");
            return;
        }
        const declaredNotary = unverified.notaryEName;
        const declaredClaim = unverified.claim;
        if (
            typeof declaredNotary !== "string" ||
            typeof declaredClaim !== "string"
        ) {
            failNotary("This recovery code is missing required fields.");
            return;
        }

        // 2. Hit registry whitelist.
        let whitelist: NotaryWhitelistEntry[];
        try {
            const resp = await axios.get<NotaryWhitelistEntry[]>(
                new URL("/notaries", PUBLIC_REGISTRY_URL).toString(),
                { timeout: 8_000 },
            );
            whitelist = Array.isArray(resp.data) ? resp.data : [];
        } catch (err) {
            console.error("[RECOVERY/notary] whitelist fetch failed:", err);
            failNotary("Couldn't reach the registry to verify the notary.");
            return;
        }
        const entry = whitelist.find((e) => e.ename === declaredNotary);
        if (!entry) {
            failNotary(
                "This recovery code wasn't issued by a recognised notary.",
            );
            return;
        }

        // 3. Claim URL must live on the same origin as the whitelisted notary.
        if (originOf(entry.url) !== originOf(declaredClaim)) {
            failNotary(
                "This recovery code wasn't issued by a recognised notary.",
            );
            return;
        }

        // 4. Fetch the notary's JWKS and verify the JWT signature.
        let jwksJson: { keys?: unknown[] };
        try {
            const jwksResp = await axios.get<{ keys?: unknown[] }>(
                new URL("/.well-known/jwks.json", entry.url).toString(),
                { timeout: 8_000 },
            );
            jwksJson = jwksResp.data;
        } catch (err) {
            console.error("[RECOVERY/notary] jwks fetch failed:", err);
            failNotary("Couldn't verify the notary's identity. Try again.");
            return;
        }
        const JWKS = createLocalJWKSet({
            keys: Array.isArray(jwksJson?.keys) ? jwksJson.keys : [],
        } as Parameters<typeof createLocalJWKSet>[0]);

        let verifiedPayload: NotaryRecoveryPayload;
        try {
            const { payload } = await jwtVerify(token, JWKS);
            verifiedPayload = payload as unknown as NotaryRecoveryPayload;
        } catch (err) {
            console.warn("[RECOVERY/notary] JWT verify failed:", err);
            failNotary("This recovery code's signature is invalid.");
            return;
        }

        // Sanity: confirm verified payload matches what we just whitelisted.
        if (
            verifiedPayload.notaryEName !== declaredNotary ||
            verifiedPayload.claim !== declaredClaim ||
            !verifiedPayload.sessionId ||
            !verifiedPayload.targetEName
        ) {
            failNotary("This recovery code is internally inconsistent.");
            return;
        }

        // 5. Trust established. Show the user a confirmation sheet before we
        //    consume the session.
        notarySessionId = verifiedPayload.sessionId;
        notaryClaimUrl = verifiedPayload.claim;
        notaryTargetEName = verifiedPayload.targetEName;
        notaryDisplayName = entry.name ?? verifiedPayload.notaryEName;
        notaryError = null;
        loadingPhase = null;
        step = "notary-confirm";
    } catch (err) {
        console.error("[RECOVERY/notary] unexpected:", err);
        failNotary("Something went wrong. Please try again.");
    }
}

function failNotary(msg: string) {
    loadingPhase = null;
    errorMessage = msg;
    errorReason = "generic";
    showErrorSheet = true;
    if (step === "notary-scanning") step = "home";
}

async function handleNotaryConfirm() {
    if (!notarySessionId || !notaryClaimUrl || !notaryTargetEName) return;
    notaryClaiming = true;
    notaryError = null;
    try {
        const claimResp = await axios.post<{
            success: boolean;
            eName?: string;
            uri?: string;
            reason?: string;
        }>(
            notaryClaimUrl,
            {
                sessionId: notarySessionId,
                targetEName: notaryTargetEName,
            },
            { timeout: 10_000 },
        );
        const data = claimResp.data;
        if (!data.success) {
            const reason = data.reason ?? "generic";
            notaryError =
                reason === "expired"
                    ? "This recovery code has expired. Ask the notary to issue a new one."
                    : reason === "consumed"
                      ? "This recovery code has already been used."
                      : reason === "not_found"
                        ? "We couldn't find that recovery code."
                        : "Something went wrong claiming the code.";
            return;
        }

        const ename = data.eName ?? notaryTargetEName;
        const uri = data.uri;
        if (!uri) {
            notaryError = "The notary didn't return a vault URL.";
            return;
        }

        // Hand off to the same downstream the verified path uses: populate
        // the eVault Found sheet's state and let recoverVault() do the rest.
        recoveredW3id = ename;
        recoveredUri = uri;
        recoveredVaultUri = uri;
        try {
            const client = makeRecoveryClient(uri, ename);
            recoveredIdVerif = await fetchRecoveryProfile(client);
        } catch (err) {
            console.warn(
                "[RECOVERY/notary] profile fetch failed; continuing without:",
                err,
            );
            recoveredIdVerif = null;
        }
        showFoundSheet = true;
        step = "home";
    } catch (err) {
        console.error("[RECOVERY/notary] claim failed:", err);
        notaryError = "Couldn't reach the notary. Check your connection.";
    } finally {
        notaryClaiming = false;
    }
}

function handleNotaryCancel() {
    notarySessionId = null;
    notaryClaimUrl = null;
    notaryTargetEName = null;
    notaryDisplayName = null;
    notaryError = null;
    step = "home";
}

// ── Found → store + register ───────────────────────────────────────────

async function recoverVault() {
    if (!recoveredW3id) return;
    storing = true;
    try {
        const iv = recoveredIdVerif;

        const fullName =
            iv?.full_name ??
            [iv?.first_name, iv?.last_name].filter(Boolean).join(" ") ??
            "";
        const dob = iv?.date_of_birth ?? "";
        const docType = iv?.document_type ?? "";
        const docNumber = iv?.document_number ?? "";
        const country = iv?.issuing_state_name ?? iv?.issuing_state ?? "";
        const expiryDate = iv?.expiration_date ?? "";
        const issueDate = iv?.date_of_issue ?? "";

        const user: Record<string, string> = iv
            ? {
                  name: capitalize(fullName),
                  "Date of Birth": dob ? new Date(dob).toDateString() : "",
                  "ID submitted":
                      [docType, country].filter(Boolean).join(" - ") ||
                      "Verified",
                  "Document Number": docNumber,
              }
            : {
                  name: recoveredW3id,
                  "Date of Birth": "",
                  "ID submitted": "Anonymous — Self Declaration",
                  "Document Number": "",
              };
        const document: Record<string, string> = {
            "Valid From": issueDate ? new Date(issueDate).toDateString() : "",
            "Valid Until": expiryDate
                ? new Date(expiryDate).toDateString()
                : "",
            "Verified On": new Date().toDateString(),
        };

        pendingRecovery.set({
            uri: recoveredUri ?? "",
            ename: recoveredW3id,
            user,
            document,
        });

        // Recovery joins the onboarding step machine: it skips the name step
        // (recovery already has the name) and the final action after the
        // biometrics step persists the recovered vault instead of provisioning
        // a new one.
        await goto("/onboarding", { replaceState: true });
    } catch (err) {
        console.error("[RECOVERY] store failed:", err);
        errorMessage = "Failed to restore your eVault. Please try again.";
        errorReason = "generic";
        showFoundSheet = false;
        showErrorSheet = true;
    } finally {
        storing = false;
    }
}

function cancelFound() {
    showFoundSheet = false;
    recoveredW3id = null;
    recoveredUri = null;
    recoveredIdVerif = null;
    step = "home";
}

// ── Back handlers ──────────────────────────────────────────────────────

function handleUnverifiedEnameBack() {
    enameError = null;
    step = "home";
}

function handleUnverifiedAnswerBack() {
    answerError = null;
    step = "unverified-ename";
}

onMount(() => {
    // Reset to the home choice every time we land here — flow state is
    // in-memory only, so a refresh always restarts cleanly.
    step = "home";
});
</script>

<!-- ── Top-level page chrome ───────────────────────────────────────────── -->
{#if step === "home"}
    <main
        class="min-h-dvh px-[5vw] flex flex-col bg-white"
        style="padding-top: max(2svh, env(safe-area-inset-top)); padding-bottom: max(16px, env(safe-area-inset-bottom));"
    >
        <header class="flex flex-row items-center gap-4 pt-4 relative">
            <button
                type="button"
                onclick={handleHomeBack}
                aria-label="Back"
                class="w-10 h-10 absolute rounded-full bg-black-100 flex items-center justify-center cursor-pointer shrink-0 active:opacity-70"
            >
                <HugeiconsIcon
                    icon={ArrowLeft01Icon}
                    size={20}
                    color="currentColor"
                    strokeWidth={2}
                />
            </button>
            <div class="flex flex-col w-full items-center">
                <h3 class="font-semibold leading-none">Restore DigitalSelf</h3>
            </div>
        </header>

        <section
            class="flex-1 flex flex-col justify-center items-center gap-3 px-2"
        >
            <h2
                class="text-3xl font-bold text-black-900 text-center leading-tight"
            >
                Already have<br />an eVault?
            </h2>
            <p
                class="text-black-500 text-center text-base leading-snug max-w-70"
            >
                Were you idenity-verified when you set up your eVault?
            </p>
        </section>

        <div class="flex flex-col gap-3 pt-4 pb-2">
            <button
                type="button"
                onclick={handleChooseVerified}
                class="w-full rounded-2xl bg-card-alternative px-5 py-4 text-left flex items-center justify-between gap-3 active:opacity-70 transition-opacity"
            >
                <div class="flex-1 min-w-0">
                    <p class="font-bold text-base text-black-900 mb-0.5">
                        Yes, I verified my ID
                    </p>
                    <p class="text-sm text-black-500 leading-snug">
                        We'll use your verified identity to find and confirm
                        your previous eVault.
                    </p>
                </div>
                <span class="text-black-500 text-2xl shrink-0">›</span>
            </button>
            <button
                type="button"
                onclick={handleChooseUnverified}
                class="w-full rounded-2xl bg-card-alternative px-5 py-4 text-left flex items-center justify-between gap-3 active:opacity-70 transition-opacity"
            >
                <div class="flex-1 min-w-0">
                    <p class="font-bold text-base text-black-900 mb-0.5">
                        No, I didn't verify my ID
                    </p>
                    <p class="text-sm text-black-500 leading-snug">
                        Recover using your eName and the security question you
                        set during onboarding.
                    </p>
                </div>
                <span class="text-black-500 text-2xl shrink-0">›</span>
            </button>
            <button
                type="button"
                onclick={handleChooseNotary}
                class="w-full rounded-2xl bg-card-alternative px-5 py-4 text-left flex items-center justify-between gap-3 active:opacity-70 transition-opacity"
            >
                <div class="flex-1 min-w-0">
                    <p class="font-bold text-base text-black-900 mb-0.5">
                        I am at a notary
                    </p>
                    <p class="text-sm text-black-500 leading-snug">
                        Scan the recovery QR your notary has issued for you.
                    </p>
                </div>
                <span class="text-black-500 text-2xl shrink-0">›</span>
            </button>
        </div>
    </main>
{:else if step === "unverified-ename"}
    <main
        use:keyboardInset
        class="h-dvh overflow-hidden px-[5vw] flex flex-col bg-white"
        style="padding-top: max(2svh, env(safe-area-inset-top)); padding-bottom: calc(max(16px, env(safe-area-inset-bottom)) + var(--kb-inset, 0px));"
    >
        <header class="flex flex-row items-center gap-4 pt-4 relative">
            <button
                type="button"
                onclick={handleUnverifiedEnameBack}
                aria-label="Back"
                class="w-10 h-10 absolute rounded-full bg-black-100 flex items-center justify-center cursor-pointer shrink-0 active:opacity-70"
            >
                <HugeiconsIcon
                    icon={ArrowLeft01Icon}
                    size={20}
                    color="currentColor"
                    strokeWidth={2}
                />
            </button>
            <div class="flex flex-col w-full items-center">
                <h3 class="font-semibold leading-none">Restore</h3>
                <p class="text-black-500 text-sm mt-1 leading-none">
                    Unverified ID
                </p>
            </div>
        </header>

        <section class="flex flex-col items-center gap-3 pt-12">
            <h2
                class="text-3xl font-bold text-black-900 text-center leading-tight"
            >
                Enter your eName
            </h2>
            <p
                class="text-black-500 text-center text-base leading-snug max-w-75"
            >
                We'll use your eName to look up your eVault, then ask you to
                answer the security question you set up.
            </p>
        </section>

        <section class="flex flex-col gap-2 pt-8">
            <label
                class="text-black-700 font-medium text-sm"
                for="recover-ename"
            >
                Your eName <span class="text-danger">*</span>
            </label>
            <input
                id="recover-ename"
                type="text"
                bind:value={enameInput}
                autocomplete="username"
                autocapitalize="off"
                autocorrect="off"
                spellcheck="false"
                placeholder="e.g. @4f2a9c1b-..."
                class="w-full bg-card-alternative rounded-full px-5 py-4 placeholder:text-black-300 outline-none focus:ring-2 focus:ring-primary"
            />
            {#if enameError}
                <p class="text-danger text-sm font-medium" role="alert">
                    {enameError}
                </p>
            {/if}
        </section>

        <footer class="mt-auto flex flex-col gap-3 pt-4">
            <ButtonAction
                variant="soft"
                class="w-full uppercase tracking-wide"
                callback={() => {
                    showRecoveryImpossibleSheet = true;
                }}
            >
                I forgot my eName
            </ButtonAction>
            <ButtonAction
                class="w-full uppercase tracking-wide"
                disabled={enameLoading || !enameInput.trim()}
                isLoading={enameLoading}
                callback={handleSubmitEname}
                blockingClick
            >
                Restore
            </ButtonAction>
        </footer>
    </main>
{:else if step === "unverified-answer"}
    <main
        use:keyboardInset
        class="h-dvh overflow-hidden px-[5vw] flex flex-col bg-white"
        style="padding-top: max(2svh, env(safe-area-inset-top)); padding-bottom: calc(max(16px, env(safe-area-inset-bottom)) + var(--kb-inset, 0px));"
    >
        <header class="flex flex-row items-center gap-4 pt-4 relative">
            <button
                type="button"
                onclick={handleUnverifiedAnswerBack}
                aria-label="Back"
                class="w-10 h-10 absolute rounded-full bg-black-100 flex items-center justify-center cursor-pointer shrink-0 active:opacity-70"
            >
                <HugeiconsIcon
                    icon={ArrowLeft01Icon}
                    size={20}
                    color="currentColor"
                    strokeWidth={2}
                />
            </button>
            <div class="flex flex-col w-full items-center">
                <h3 class="font-semibold leading-none">Restore</h3>
                <p class="text-black-500 text-sm mt-1 leading-none">
                    Unverified ID
                </p>
            </div>
        </header>

        <section class="flex flex-col items-center gap-3 pt-12">
            <h2
                class="text-3xl font-bold text-black-900 text-center leading-tight"
            >
                Enter answer<br />to your question
            </h2>
        </section>

        <section class="flex flex-col gap-2 pt-8">
            <label
                class="text-black-700 font-medium text-sm"
                for="recover-answer"
            >
                {securityQuestion} <span class="text-danger">*</span>
            </label>
            <input
                id="recover-answer"
                type="text"
                bind:value={answerInput}
                autocomplete="off"
                autocapitalize="off"
                autocorrect="off"
                spellcheck="false"
                placeholder="Your answer"
                class="w-full bg-card-alternative rounded-full px-5 py-4 placeholder:text-black-300 outline-none focus:ring-2 focus:ring-primary"
            />
            {#if answerError}
                <p class="text-danger text-sm font-medium" role="alert">
                    {answerError}
                </p>
            {/if}
        </section>

        <footer class="mt-auto flex flex-col gap-3 pt-4">
            <ButtonAction
                variant="soft"
                class="w-full uppercase tracking-wide"
                callback={() => {
                    showNotarySheet = true;
                }}
            >
                I forgot my answer
            </ButtonAction>
            <ButtonAction
                class="w-full uppercase tracking-wide"
                disabled={answerLoading || !answerInput.trim()}
                isLoading={answerLoading}
                callback={handleSubmitAnswer}
                blockingClick
            >
                Restore
            </ButtonAction>
        </footer>
    </main>
{:else if step === "verified-didit"}
    <div
        class="fixed inset-0 z-50 bg-white flex flex-col"
        style="padding-top: max(16px, env(safe-area-inset-top)); padding-bottom: max(24px, env(safe-area-inset-bottom));"
    >
        <div class="flex-none flex justify-end px-4 pt-2">
            <button
                class="text-sm text-black-500 underline"
                onclick={() => {
                    step = "home";
                }}
            >
                Cancel
            </button>
        </div>
        <div id="recovery-didit-container" class="flex-1 w-full"></div>
    </div>
{:else if step === "notary-scanning"}
    <!-- Crosshair-only overlay while the native scanner is open. body
         class makes the WebView transparent so the camera feed shows
         through. Same SVG primitives as /scan-qr's overlay. -->
    <main
        class="min-h-dvh flex flex-col items-center justify-center px-6 gap-10"
    >
        <svg
            class="mx-auto"
            width="204"
            height="215"
            viewBox="0 0 204 215"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M46 4H15C8.92487 4 4 8.92487 4 15V46"
                stroke="white"
                stroke-width="8"
                stroke-linecap="round"
            />
            <path
                d="M158 4H189C195.075 4 200 8.92487 200 15V46"
                stroke="white"
                stroke-width="8"
                stroke-linecap="round"
            />
            <path
                d="M46 211H15C8.92487 211 4 206.075 4 200V169"
                stroke="white"
                stroke-width="8"
                stroke-linecap="round"
            />
            <path
                d="M158 211H189C195.075 211 200 206.075 200 200V169"
                stroke="white"
                stroke-width="8"
                stroke-linecap="round"
            />
        </svg>
        <h4 class="text-white font-semibold text-center">
            Point the camera at the notary's QR
        </h4>
    </main>
{:else if step === "notary-confirm"}
    <main
        class="h-dvh overflow-hidden px-[5vw] flex flex-col bg-white"
        style="padding-top: max(2svh, env(safe-area-inset-top)); padding-bottom: max(16px, env(safe-area-inset-bottom));"
    >
        <header class="flex flex-row items-center gap-4 pt-4 relative">
            <button
                type="button"
                onclick={handleNotaryCancel}
                aria-label="Back"
                class="w-10 h-10 absolute rounded-full bg-black-100 flex items-center justify-center cursor-pointer shrink-0 active:opacity-70"
            >
                <HugeiconsIcon
                    icon={ArrowLeft01Icon}
                    size={20}
                    color="currentColor"
                    strokeWidth={2}
                />
            </button>
            <div class="flex flex-col w-full items-center">
                <h3 class="font-semibold leading-none">Notary recovery</h3>
            </div>
        </header>

        <section class="flex-1 flex flex-col justify-center gap-3 px-2">
            <h2
                class="text-3xl font-bold text-black-900 text-center leading-tight"
            >
                Recover {notaryTargetEName ?? ""}?
            </h2>
            <p class="text-black-500 text-center text-base leading-snug">
                This recovery code was issued by
                <span class="font-semibold text-black-900"
                    >{notaryDisplayName ?? ""}</span
                >.
                Continue only if you're with them in person.
            </p>

            {#if notaryError}
                <p
                    class="text-danger text-sm font-medium text-center mt-2"
                    role="alert"
                >
                    {notaryError}
                </p>
            {/if}
        </section>

        <footer class="w-full flex flex-col gap-3 pt-4">
            <ButtonAction
                class="w-full uppercase tracking-wide"
                disabled={notaryClaiming}
                isLoading={notaryClaiming}
                callback={handleNotaryConfirm}
                blockingClick
            >
                Continue
            </ButtonAction>
            <ButtonAction
                variant="soft"
                class="w-full uppercase tracking-wide"
                disabled={notaryClaiming}
                callback={handleNotaryCancel}
            >
                Cancel
            </ButtonAction>
        </footer>
    </main>
{/if}

<!-- ── Loading overlay (preparing / finding) ──────────────────────────── -->
<LoadingSheet
    isOpen={loadingPhase !== null}
    title={loadingTitle}
    subtitle={loadingSubtitle}
    oncancel={cancelLoading}
/>

<!-- ── eVault Found bottom sheet ──────────────────────────────────────── -->
<BottomSheet bind:isOpen={showFoundSheet} dismissible={false}>
    <header class="flex flex-col items-center gap-1">
        <h2 class="text-2xl font-bold text-black-900">eVault Found</h2>
        <p class="text-sm text-black-500 text-center">
            Please review the connection details below
        </p>
    </header>

    {#if recoveredW3id}
        <div
            class="bg-card-alternative rounded-2xl px-5 py-5 flex flex-col items-center gap-2"
        >
            <p class="text-base font-bold text-black-900">Your eName</p>
            <p class="font-mono text-sm text-black-700 break-all text-center">
                {recoveredW3id}
            </p>
        </div>
    {/if}

    <p class="text-sm text-black-500 text-center leading-snug">
        We confirmed your identity. Here's your previous eVault - tap Continue
        to restore access. If a recovery passphrase exists, we'll ask you to
        verify it before continuing.
    </p>

    <div class="flex gap-3 pt-2">
        <ButtonAction
            variant="soft"
            class="flex-1 uppercase tracking-wide"
            callback={cancelFound}
            disabled={storing}
        >
            Cancel
        </ButtonAction>
        <ButtonAction
            class="flex-1 uppercase tracking-wide"
            callback={recoverVault}
            disabled={storing}
            isLoading={storing}
            blockingClick
        >
            Continue
        </ButtonAction>
    </div>
</BottomSheet>

<!-- ── Recovery not possible bottom sheet (forgot eName) ──────────────── -->
<BottomSheet bind:isOpen={showRecoveryImpossibleSheet}>
    <header class="flex flex-col items-center gap-1">
        <h2 class="text-2xl font-bold text-black-900 text-center">
            Recovery not possible
        </h2>
    </header>

    <p class="text-sm text-black-500 text-center leading-snug">
        Without your eName and without ID verification, there is no way to
        recover your eVault. Your eName is your unique identifier - it cannot be
        looked up without a verified identity.
    </p>

    <ButtonAction
        class="w-full uppercase tracking-wide"
        callback={() => {
            showRecoveryImpossibleSheet = false;
            goto("/onboarding");
        }}
    >
        Create a new eVault
    </ButtonAction>
</BottomSheet>

<!-- ── Notary required bottom sheet (forgot answer) ───────────────────── -->
<BottomSheet bind:isOpen={showNotarySheet}>
    <header class="flex flex-col items-center gap-1">
        <h2 class="text-2xl font-bold text-black-900 text-center">
            Visit a W3DS Notary
        </h2>
    </header>

    <p class="text-sm text-black-500 text-center leading-snug">
        Without your answer, your eVault cannot be restored automatically. A
        Registered W3DS Notary can verify your identity in person using trusted
        witnesses or other proofs of ownership and authorise recovery on your
        behalf.
    </p>

    <ButtonAction
        variant="soft"
        class="w-full uppercase tracking-wide"
        callback={() => {
            showNotarySheet = false;
        }}
    >
        Back
    </ButtonAction>
</BottomSheet>

<!-- ── Error bottom sheet (verified path) ─────────────────────────────── -->
<BottomSheet bind:isOpen={showErrorSheet}>
    <header class="flex flex-col items-center gap-1">
        <h2 class="text-2xl font-bold text-black-900 text-center">
            {#if errorReason === "liveness_failed"}
                Liveness check failed
            {:else if errorReason === "no_match"}
                No eVault found
            {:else}
                Something went wrong
            {/if}
        </h2>
    </header>

    <p class="text-sm text-black-500 text-center leading-snug">
        {errorMessage}
    </p>

    <div class="flex flex-col gap-3 pt-2">
        {#if errorReason !== "no_match"}
            <ButtonAction
                class="w-full uppercase tracking-wide"
                callback={() => {
                    showErrorSheet = false;
                    startVerifiedRecovery();
                }}
            >
                Try Again
            </ButtonAction>
        {/if}
        <ButtonAction
            variant="soft"
            class="w-full uppercase tracking-wide"
            callback={() => {
                showErrorSheet = false;
            }}
        >
            Back
        </ButtonAction>
    </div>
</BottomSheet>
