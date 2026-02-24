<script lang="ts">
import { goto } from "$app/navigation";
import {
    PUBLIC_PROVISIONER_URL,
    PUBLIC_REGISTRY_URL,
} from "$env/static/public";
import { pendingRecovery } from "$lib/stores/pendingRecovery";
import { ButtonAction } from "$lib/ui";
import { capitalize } from "$lib/utils";
import axios from "axios";
import { onMount } from "svelte";

interface DiditCompleteResult {
    type?: string;
    session?: {
        sessionId?: string;
    };
}

type RecoveryStep =
    | "starting"
    | "didit-verification"
    | "searching"
    | "found"
    | "passphrase-gate"
    | "notary-required"
    | "error";

let step = $state<RecoveryStep>("starting");
let errorMessage = $state<string | null>(null);
let errorReason = $state<"liveness_failed" | "no_match" | "generic">("generic");

let recoveredW3id = $state<string | null>(null);
let recoveredUri = $state<string | null>(null);
let recoveredIdVerif = $state<Record<string, string> | null>(null);
let storing = $state(false);

// Passphrase gate state
let passphraseInput = $state("");
let passphraseError = $state<string | null>(null);
let passphraseLoading = $state(false);
let checkingPassphrase = $state(false);

onMount(() => {
    startRecovery();
});

async function resolveEvaultBase(w3id: string): Promise<string> {
    const res = await axios.get(
        new URL(
            `resolve?w3id=${encodeURIComponent(w3id)}`,
            PUBLIC_REGISTRY_URL,
        ).toString(),
    );
    return res.data.uri as string;
}

async function startRecovery() {
    step = "starting";
    errorMessage = null;
    recoveredW3id = null;
    recoveredUri = null;
    recoveredIdVerif = null;
    passphraseInput = "";
    passphraseError = null;

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

        step = "didit-verification";
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
        step = "error";
    }
}

async function handleDiditComplete(result: DiditCompleteResult) {
    console.log("[RECOVERY] Didit onComplete:", result);

    if (result.type === "cancelled") {
        goto("/onboarding");
        return;
    }

    if (!result.session?.sessionId) {
        errorMessage =
            "The verification session did not return a session ID. Please try again.";
        errorReason = "generic";
        step = "error";
        return;
    }

    step = "searching";

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
            step = "error";
            return;
        }

        recoveredW3id = data.w3id;
        recoveredUri = data.uri ?? null;
        recoveredIdVerif = data.idVerif ?? null;
        step = "found";
    } catch (err: unknown) {
        console.error("[RECOVERY] face-search error:", err);
        errorMessage =
            "Something went wrong during the search. Please try again.";
        errorReason = "generic";
        step = "error";
    }
}

async function checkPassphraseRequired() {
    if (!recoveredW3id || !recoveredUri) return;
    checkingPassphrase = true;
    passphraseError = null;

    try {
        const evaultBase = await resolveEvaultBase(recoveredW3id);
        const res = await axios.get(
            new URL("/passphrase/status", evaultBase).toString(),
            { headers: { "X-ENAME": recoveredW3id } },
        );

        if (res.data?.hasPassphrase) {
            step = "passphrase-gate";
        } else {
            // No passphrase set: proceed directly after successful face verification.
            await recoverVault();
        }
    } catch (err: unknown) {
        console.error("[RECOVERY] passphrase status check error:", err);
        // If we cannot verify passphrase policy, fall back to manual recovery.
        step = "notary-required";
    } finally {
        checkingPassphrase = false;
    }
}

async function verifyAndRecover() {
    if (!recoveredW3id || !recoveredUri || !passphraseInput) return;
    passphraseLoading = true;
    passphraseError = null;

    try {
        const evaultBase = await resolveEvaultBase(recoveredW3id);
        const res = await axios.post(
            new URL("/passphrase/compare", evaultBase).toString(),
            { eName: recoveredW3id, passphrase: passphraseInput },
        );

        if (res.data?.match) {
            await recoverVault();
        } else {
            passphraseError = "Incorrect passphrase. Please try again.";
        }
    } catch (err: unknown) {
        if (axios.isAxiosError(err) && err.response?.status === 429) {
            const retryAfter =
                err.response.data?.retryAfterSeconds ?? "a while";
            passphraseError = `Too many attempts. Please wait ${retryAfter} seconds before trying again.`;
        } else {
            passphraseError = "Failed to verify passphrase. Please try again.";
        }
        console.error("[RECOVERY] passphrase compare error:", err);
    } finally {
        passphraseLoading = false;
    }
}

async function recoverVault() {
    if (!recoveredW3id || !recoveredUri) return;
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

        const user: Record<string, string> = {
            name: capitalize(fullName),
            "Date of Birth": dob ? new Date(dob).toDateString() : "",
            "ID submitted":
                [docType, country].filter(Boolean).join(" - ") || "Verified",
            "Document Number": docNumber,
        };
        const document: Record<string, string> = {
            "Valid From": issueDate ? new Date(issueDate).toDateString() : "",
            "Valid Until": expiryDate
                ? new Date(expiryDate).toDateString()
                : "",
            "Verified On": new Date().toDateString(),
        };

        pendingRecovery.set({
            uri: recoveredUri,
            ename: recoveredW3id,
            user,
            document,
        });

        await goto("/register");
    } catch (err) {
        console.error("[RECOVERY] store failed:", err);
        errorMessage = "Failed to restore your eVault. Please try again.";
        errorReason = "generic";
        step = "error";
    } finally {
        storing = false;
    }
}
</script>

<!-- ── Didit embedded verification (full-screen) ─────────────────────────── -->
{#if step === "didit-verification"}
    <div
        class="fixed inset-0 z-50 bg-white flex flex-col"
        style="padding-top: max(16px, env(safe-area-inset-top)); padding-bottom: max(24px, env(safe-area-inset-bottom));"
    >
        <div class="flex-none flex justify-end px-4 pt-2">
            <button
                class="text-sm text-black-500 underline"
                onclick={() => goto("/onboarding")}
            >
                Cancel
            </button>
        </div>
        <div id="recovery-didit-container" class="flex-1 w-full"></div>
    </div>
{:else}
    <!-- Background page — spinner while preparing / searching -->
    <main
        class="flex min-h-screen flex-col items-center justify-center bg-background px-6 gap-4"
        style="padding-top: max(5.2svh, env(safe-area-inset-top)); padding-bottom: max(2rem, env(safe-area-inset-bottom));"
    >
        {#if step === "starting" || step === "searching"}
            <div class="h-14 w-14 animate-spin rounded-full border-4 border-gray-200 border-t-primary-500"></div>
            <p class="font-semibold text-black-900 text-center">
                {#if step === "starting"}
                    Preparing verification…
                {:else}
                    Finding your eVault…
                {/if}
            </p>
            <p class="text-sm text-black-700 text-center">
                {#if step === "starting"}
                    Setting up your recovery session.
                {:else}
                    Looking for an eVault linked to your identity.
                {/if}
            </p>
            {#if step === "starting"}
                <button
                    onclick={() => goto("/onboarding")}
                    class="mt-4 text-sm text-black-500 underline"
                >
                    Cancel
                </button>
            {/if}
        {/if}
    </main>
{/if}

<!-- ── "eVault found" bottom sheet ─────────────────────────────────────────── -->
{#if step === "found"}
    <div class="fixed inset-0 z-40 bg-black/40" aria-hidden="true"></div>
    <div
        class="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-xl flex flex-col gap-4"
        style="padding: 1.5rem 1.5rem max(1.5rem, env(safe-area-inset-bottom));"
    >
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-lg font-bold">
                ✓
            </div>
            <h3 class="text-lg font-bold">eVault Found</h3>
        </div>
        <p class="text-black-700 text-sm">
            We confirmed your identity. Here's your previous eVault — tap Continue
            to restore access. If a recovery passphrase exists, we'll ask you to
            verify it before continuing.
        </p>
        <div class="rounded-2xl bg-gray-50 border border-gray-200 p-4 flex flex-col gap-1">
            <p class="text-xs text-black-500 font-medium uppercase tracking-wide">Your eName</p>
            <p class="font-mono text-sm font-semibold text-black-900 break-all">{recoveredW3id}</p>
        </div>
        <div class="flex flex-col gap-3 pt-2">
            <ButtonAction
                class="w-full"
                blockingClick
                callback={checkPassphraseRequired}
                disabled={checkingPassphrase}
            >
                {checkingPassphrase ? "Checking…" : "Continue →"}
            </ButtonAction>
            <ButtonAction
                variant="soft"
                class="w-full"
                callback={() => goto("/onboarding")}
            >
                That's not me — cancel
            </ButtonAction>
        </div>
    </div>
{/if}

<!-- ── Passphrase gate bottom sheet ─────────────────────────────────────────── -->
{#if step === "passphrase-gate"}
    <div class="fixed inset-0 z-40 bg-black/40" aria-hidden="true"></div>
    <div
        class="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-xl flex flex-col gap-4"
        style="padding: 1.5rem 1.5rem max(1.5rem, env(safe-area-inset-bottom));"
    >
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-lg font-bold">
                🔑
            </div>
            <h3 class="text-lg font-bold">Enter Recovery Passphrase</h3>
        </div>
        <p class="text-black-700 text-sm">
            A recovery passphrase is required to restore this eVault. Please enter the passphrase you set in Settings.
        </p>
        <div class="flex flex-col gap-1">
            <label for="recovery-passphrase" class="text-sm font-medium text-black-700">
                Recovery Passphrase
            </label>
            <input
                id="recovery-passphrase"
                type="password"
                bind:value={passphraseInput}
                autocomplete="current-password"
                placeholder="Enter your recovery passphrase"
                class="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition"
                onkeydown={(e) => { if (e.key === "Enter" && passphraseInput) verifyAndRecover(); }}
            />
            {#if passphraseError}
                <p class="text-xs text-red-500 mt-1">{passphraseError}</p>
            {/if}
        </div>
        <div class="flex flex-col gap-3 pt-2">
            <ButtonAction
                class="w-full"
                blockingClick
                callback={verifyAndRecover}
                disabled={passphraseLoading || !passphraseInput}
            >
                {passphraseLoading ? "Verifying…" : "Verify & Recover"}
            </ButtonAction>
            <ButtonAction
                variant="soft"
                class="w-full"
                callback={() => goto("/onboarding")}
            >
                Cancel
            </ButtonAction>
        </div>
    </div>
{/if}

<!-- ── Notary required bottom sheet ─────────────────────────────────────────── -->
{#if step === "notary-required"}
    <div class="fixed inset-0 z-40 bg-black/40" aria-hidden="true"></div>
    <div
        class="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-xl flex flex-col gap-4"
        style="padding: 1.5rem 1.5rem max(1.5rem, env(safe-area-inset-bottom));"
    >
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-lg font-bold">
                !
            </div>
            <h3 class="text-lg font-bold">Manual Recovery Required</h3>
        </div>
        <p class="text-black-700 text-sm leading-relaxed">
            We couldn't verify the passphrase policy for this eVault right now, so
            automatic recovery is unavailable.
        </p>
        <p class="text-black-700 text-sm leading-relaxed">
            To recover your eVault, you must visit a <strong>Registered W3DS Notary</strong> in person.
            They can verify your identity and authorise access to your eVault.
        </p>
        <div class="flex flex-col gap-3 pt-2">
            <ButtonAction variant="soft" class="w-full" callback={() => goto("/onboarding")}>
                Back to Onboarding
            </ButtonAction>
        </div>
    </div>
{/if}

<!-- ── Error bottom sheet ──────────────────────────────────────────────────── -->
{#if step === "error"}
    <div class="fixed inset-0 z-40 bg-black/40" aria-hidden="true"></div>
    <div
        class="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-xl flex flex-col gap-4"
        style="padding: 1.5rem 1.5rem max(1.5rem, env(safe-area-inset-bottom));"
    >
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-lg font-bold">
                ✗
            </div>
            <h3 class="text-lg font-bold">
                {#if errorReason === "liveness_failed"}
                    Liveness Check Failed
                {:else if errorReason === "no_match"}
                    No eVault Found
                {:else}
                    Something Went Wrong
                {/if}
            </h3>
        </div>
        <p class="text-black-700 text-sm">{errorMessage}</p>
        <div class="flex flex-col gap-3 pt-2">
            {#if errorReason !== "no_match"}
                <ButtonAction class="w-full" callback={startRecovery}>
                    Try Again
                </ButtonAction>
            {/if}
            <ButtonAction variant="soft" class="w-full" callback={() => goto("/onboarding")}>
                Back to Onboarding
            </ButtonAction>
        </div>
    </div>
{/if}
