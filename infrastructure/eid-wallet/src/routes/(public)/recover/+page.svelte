<script lang="ts">
import { goto } from "$app/navigation";
import {
    PUBLIC_EID_WALLET_TOKEN,
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
import axios from "axios";
import { GraphQLClient } from "graphql-request";
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
    | "unverified-answer";

/** Loading overlay phases — rendered as a LoadingSheet on top of whatever
 *  step is active, so the underlying screen stays visible (and blurred). */
type LoadingPhase = "starting-session" | "finding-evault" | null;

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
          : "",
);
const loadingSubtitle = $derived(
    loadingPhase === "starting-session"
        ? "Setting up your recovery session."
        : loadingPhase === "finding-evault"
          ? "Looking for an eVault linked to your identity."
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
            recoveredIdVerif = null; // unverified path → no ID data
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
                        Recover using your eName and recovery passphrase, or get
                        help from a W3DS Notary
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
