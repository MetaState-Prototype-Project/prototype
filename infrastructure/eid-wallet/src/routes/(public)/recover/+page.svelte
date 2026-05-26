<script lang="ts">
import { goto } from "$app/navigation";
import {
    PUBLIC_PROVISIONER_URL,
    PUBLIC_REGISTRY_URL,
} from "$env/static/public";
import { keyboardInset } from "$lib/actions/keyboardInset";
import { pendingRecovery } from "$lib/stores/pendingRecovery";
import { ButtonAction } from "$lib/ui";
import BottomSheet from "$lib/ui/BottomSheet/BottomSheet.svelte";
import { capitalize } from "$lib/utils";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import axios from "axios";
import { onMount } from "svelte";

/**
 * Unified restore flow.
 *
 * Two top-level paths, picked on the "Restore DigitalSelf" home screen:
 *   1. Verified — Didit face match against an ID-verified eVault.
 *      Existing provisioner endpoints (/recovery/start-session, /recovery/face-search)
 *      are still wired up here.
 *   2. Unverified — type your eName, then answer the security question you
 *      set when you created the eVault. The matching backend endpoints are
 *      not in place yet (see incoming PR), so the unverified path is mocked
 *      below: any eName/answer succeeds and we route to /register with a
 *      synthetic recovery payload.
 */

type Step =
    | "home"
    | "verified-loading"
    | "verified-didit"
    | "verified-searching"
    | "unverified-ename"
    | "unverified-answer";

type ErrorReason = "liveness_failed" | "no_match" | "generic";

interface DiditCompleteResult {
    type?: string;
    session?: {
        sessionId?: string;
    };
}

let step = $state<Step>("home");

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

// Question text is normally fetched from the eVault by eName. The unverified
// backend isn't wired yet, so we display a mock question for the demo.
let securityQuestion = $state<string>("Mother child surname");

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
    step = "verified-loading";
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

    step = "verified-searching";

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
            step = "home";
            showErrorSheet = true;
            return;
        }

        recoveredW3id = data.w3id;
        recoveredUri = data.uri ?? null;
        recoveredIdVerif = data.idVerif ?? null;
        step = "home";
        showFoundSheet = true;
    } catch (err: unknown) {
        console.error("[RECOVERY] face-search error:", err);
        errorMessage =
            "Something went wrong during the search. Please try again.";
        errorReason = "generic";
        step = "home";
        showErrorSheet = true;
    }
}

// ── Unverified path ────────────────────────────────────────────────────

async function handleSubmitEname() {
    const ename = enameInput.trim();
    if (!ename) {
        enameError = "Please enter your eName.";
        return;
    }

    enameError = null;
    enameLoading = true;
    try {
        // Backend not wired yet — mock the question lookup. When wired up,
        // this is where we'd resolve eName → eVault and fetch the public
        // security_question binding document.
        await new Promise((r) => setTimeout(r, 350));
        securityQuestion = "Mother child surname";
        answerInput = "";
        answerError = null;
        step = "unverified-answer";
    } catch (err: unknown) {
        console.error("[RECOVERY/unverified] eName lookup error:", err);
        enameError =
            "We couldn't find an eVault for this eName. Check it and try again.";
    } finally {
        enameLoading = false;
    }
}

async function handleSubmitAnswer() {
    const answer = answerInput.trim();
    if (!answer) {
        answerError = "Please enter your answer.";
        return;
    }

    answerError = null;
    answerLoading = true;
    try {
        // Mock: any non-empty answer is accepted. When the backend lands,
        // this is where we'd POST the answer for the eVault to verify
        // against its stored Argon2id hash.
        await new Promise((r) => setTimeout(r, 350));

        const ename = enameInput.trim();
        recoveredW3id = ename;
        // Try to resolve the eVault URI in case the eName is real; fall back
        // to a placeholder so the demo still routes through to register.
        try {
            recoveredUri = await resolveEvaultBase(ename);
        } catch {
            recoveredUri = "";
        }
        recoveredIdVerif = null;
        showFoundSheet = true;
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

        await goto("/register");
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
{:else if step === "verified-loading" || step === "verified-searching"}
    <main
        class="flex min-h-dvh flex-col items-center justify-center bg-white px-6 gap-4"
        style="padding-top: max(5.2svh, env(safe-area-inset-top)); padding-bottom: max(2rem, env(safe-area-inset-bottom));"
    >
        <div
            class="h-14 w-14 animate-spin rounded-full border-4 border-gray-200 border-t-primary-500"
        ></div>
        <p class="font-semibold text-black-900 text-center">
            {#if step === "verified-loading"}
                Preparing verification…
            {:else}
                Finding your eVault…
            {/if}
        </p>
        <p class="text-sm text-black-700 text-center">
            {#if step === "verified-loading"}
                Setting up your recovery session.
            {:else}
                Looking for an eVault linked to your identity.
            {/if}
        </p>
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
