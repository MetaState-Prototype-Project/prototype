<script lang="ts">
import {
    PUBLIC_EID_WALLET_TOKEN,
    PUBLIC_PROVISIONER_SHARED_SECRET,
    PUBLIC_PROVISIONER_URL,
} from "$env/static/public";
import { AppNav, IdentityCard } from "$lib/fragments";
import type { GlobalState } from "$lib/global";
import { ButtonAction } from "$lib/ui";
import {
    addCounterpartySignature,
    capitalize,
    deleteSocialBindingDoc,
    fetchNameFromVault,
    fetchUnsignedSocialDocs,
    getCanonicalBindingDocString,
    resolveVaultUri,
} from "$lib/utils";
import axios from "axios";
import { getContext, onDestroy, onMount } from "svelte";
import { Shadow } from "svelte-loading-spinners";
import QrCode from "svelte-qrcode";

const globalState = getContext<() => GlobalState>("globalState")();

let userData = $state<Record<string, string | boolean | undefined> | undefined>(
    undefined,
);
let docData = $state<Record<string, unknown>>({});
let hasOnlySelfDocs = $state(false);
let missingProvisionerDocs = $state(false);
let bindingDocsLoaded = $state(false);

// ── Inline KYC upgrade state ──────────────────────────────────────────────────
type KycStep =
    | "idle"
    | "checking-hw"
    | "hw-error"
    | "starting"
    | "verifying"
    | "result"
    | "upgrading"
    | "duplicate";

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

interface UpgradeErrorBody {
    duplicate?: boolean;
    existingW3id?: string | null;
    message?: string;
}

let kycStep = $state<KycStep>("idle");
let kycError = $state<string | null>(null);
let diditActualSessionId = $state<string | null>(null);
let diditDecision = $state<DiditDecision | null>(null);
let diditResult = $state<"approved" | "declined" | "in_review" | null>(null);
let diditRejectionReason = $state<string | null>(null);
let duplicateEName = $state<string | null>(null);
// ─────────────────────────────────────────────────────────────────────────────

async function loadBindingDocuments(): Promise<void> {
    const vault = await globalState.vaultController.vault;
    if (!vault?.uri || !vault?.ename) {
        bindingDocsLoaded = true;
        return;
    }

    const ename = vault.ename.startsWith("@") ? vault.ename : `@${vault.ename}`;
    const gqlUrl = new URL("/graphql", vault.uri).toString();

    try {
        const res = await fetch(gqlUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-ENAME": ename,
                ...(PUBLIC_EID_WALLET_TOKEN
                    ? { Authorization: `Bearer ${PUBLIC_EID_WALLET_TOKEN}` }
                    : {}),
            },
            body: JSON.stringify({
                query: `query {
                    bindingDocuments(first: 50) {
                        edges {
                            node {
                                parsed
                            }
                        }
                    }
                }`,
            }),
        });

        const json = await res.json();
        const edges: { node: { parsed: { type: string } | null } }[] =
            json?.data?.bindingDocuments?.edges ?? [];

        const isFake = await globalState.userController.isFake;
        const types = edges.map((e) => e.node.parsed?.type ?? "");

        hasOnlySelfDocs =
            !!isFake &&
            (edges.length === 0 || types.every((t) => t === "self"));

        missingProvisionerDocs =
            !isFake &&
            !types.includes("id_document") &&
            !types.includes("photograph");
    } catch (err) {
        console.warn("[ePassport] Failed to load binding documents:", err);
    } finally {
        bindingDocsLoaded = true;
    }
}

// ── KYC upgrade functions ─────────────────────────────────────────────────────

function resetKyc() {
    kycStep = "idle";
    kycError = null;
    diditActualSessionId = null;
    diditDecision = null;
    diditResult = null;
    diditRejectionReason = null;
    duplicateEName = null;
}

async function startKycUpgrade() {
    kycError = null;
    kycStep = "checking-hw";

    const hardwareAvailable = await globalState.keyService.probeHardware();
    if (!hardwareAvailable) {
        kycStep = "hw-error";
        return;
    }

    kycStep = "starting";
    try {
        await globalState.walletSdkAdapter.ensureKey("default", "onboarding");

        const { data } = await axios.post(
            new URL("/verification/v2", PUBLIC_PROVISIONER_URL).toString(),
            {},
            {
                headers: {
                    "x-shared-secret": PUBLIC_PROVISIONER_SHARED_SECRET,
                },
            },
        );

        if (!data.verificationUrl) {
            throw new Error(
                `Backend did not return a verificationUrl. Response: ${JSON.stringify(data)}`,
            );
        }

        kycStep = "verifying";

        await new Promise((r) => setTimeout(r, 50));

        const { DiditSdk } = await import("@didit-protocol/sdk-web");
        const sdk = DiditSdk.shared;
        sdk.onComplete = handleDiditComplete;
        await sdk.startVerification({
            url: data.verificationUrl,
            configuration: {
                embedded: true,
                embeddedContainerId: "didit-container-epassport",
            },
        });
    } catch (err) {
        console.error("[KYC] Failed to start:", err);
        kycError =
            err instanceof Error
                ? err.message
                : "Failed to start verification. Please try again.";
        kycStep = "idle";
        setTimeout(() => {
            kycError = null;
        }, 6000);
    }
}

const handleDiditComplete = async (result: DiditCompleteResult) => {
    if (result.type === "cancelled") {
        resetKyc();
        return;
    }

    if (!result.session?.sessionId) {
        resetKyc();
        kycError = "Verification did not return a session ID.";
        return;
    }

    diditActualSessionId = result.session.sessionId;
    kycStep = "starting";

    try {
        const { data: decision } = await axios.get<DiditDecision>(
            new URL(
                `/verification/v2/decision/${result.session.sessionId}`,
                PUBLIC_PROVISIONER_URL,
            ).toString(),
            {
                headers: {
                    "x-shared-secret": PUBLIC_PROVISIONER_SHARED_SECRET,
                },
            },
        );

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

        kycStep = "result";
    } catch (err) {
        console.error("[KYC] Failed to fetch decision:", err);
        resetKyc();
        kycError = "Failed to retrieve verification result. Please try again.";
        setTimeout(() => {
            kycError = null;
        }, 6000);
    }
};

async function handleUpgrade() {
    if (!diditDecision) return;
    const vault = await globalState.vaultController.vault;
    const w3id = vault?.ename;
    if (!w3id) {
        kycError = "No active eVault found for upgrade.";
        return;
    }

    const sessionId =
        diditActualSessionId ??
        diditDecision.session_id ??
        diditDecision.session?.sessionId;
    if (!sessionId) {
        kycError = "Missing session ID from verification result.";
        return;
    }

    kycStep = "upgrading";
    try {
        const { data } = await axios.post(
            new URL("/verification/v2/upgrade", PUBLIC_PROVISIONER_URL).toString(),
            { diditSessionId: sessionId, w3id },
            {
                headers: {
                    "x-shared-secret": PUBLIC_PROVISIONER_SHARED_SECRET,
                },
            },
        );
        if (!data.success) {
            if (data.duplicate) {
                duplicateEName = data.existingW3id ?? null;
                kycStep = "duplicate";
            } else {
                kycError = data.message ?? "Upgrade failed";
                kycStep = "result";
            }
            return;
        }

        // Update local ePassport data from the verified Didit decision
        const idVerif = diditDecision?.id_verifications?.[0];
        if (idVerif) {
            const fullName = (
                idVerif.full_name ??
                `${idVerif.first_name ?? ""} ${idVerif.last_name ?? ""}`
            ).trim();
            const dob: string = idVerif.date_of_birth ?? "";
            const docType: string = idVerif.document_type ?? "";
            const docNumber: string = idVerif.document_number ?? "";
            const country: string =
                idVerif.issuing_state_name ?? idVerif.issuing_state ?? "";
            const expiryDate: string = idVerif.expiration_date ?? "";
            const issueDate: string = idVerif.date_of_issue ?? "";

            globalState.userController.user = {
                name: capitalize(fullName),
                "Date of Birth": dob ? new Date(dob).toDateString() : "",
                "ID submitted":
                    [docType, country].filter(Boolean).join(" - ") ||
                    "Verified",
                "Document Number": docNumber,
            };
            globalState.userController.document = {
                "Valid From": issueDate
                    ? new Date(issueDate).toDateString()
                    : "",
                "Valid Until": expiryDate
                    ? new Date(expiryDate).toDateString()
                    : "",
                "Verified On": new Date().toDateString(),
            };
            globalState.userController.isFake = false;

            // Refresh local state so card re-renders immediately
            const userInfo = await globalState.userController.user;
            userData = { ...userInfo, isFake: false };
            docData = {
                "Valid From": issueDate
                    ? new Date(issueDate).toDateString()
                    : "",
                "Valid Until": expiryDate
                    ? new Date(expiryDate).toDateString()
                    : "",
                "Verified On": new Date().toDateString(),
            };
        }

        resetKyc();
        // Refresh binding docs so amber box disappears
        bindingDocsLoaded = false;
        hasOnlySelfDocs = false;
        missingProvisionerDocs = false;
        await loadBindingDocuments();
    } catch (err: unknown) {
        console.error("[KYC] Upgrade failed:", err);
        const body: UpgradeErrorBody | undefined = axios.isAxiosError(err)
            ? (err.response?.data as UpgradeErrorBody | undefined)
            : undefined;
        if (body?.duplicate) {
            duplicateEName = body.existingW3id ?? null;
            kycStep = "duplicate";
        } else {
            kycError =
                body?.message ??
                (err instanceof Error
                    ? err.message
                    : "Upgrade failed. Please try again.");
            kycStep = "result";
            setTimeout(() => {
                kycError = null;
            }, 6000);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────

// ── Social binding state ──────────────────────────────────────────────────────
let showSocialBindingDrawer = $state(false);
let socialBindingQr = $state<string | null>(null);
let socialBindingPolling = $state(false);
let socialBindingSuccess = $state(false);
let socialBindingSignerName = $state<string | null>(null);
let socialBindingSignerEname = $state<string | null>(null);
let socialBindingPendingDocId = $state<string | null>(null);
let socialBindingPendingDocParsed = $state<{
    subject: string;
    type: string;
    data: Record<string, unknown>;
} | null>(null);
let socialBindingAwaitingConsent = $state(false);
let socialBindingError = $state<string | null>(null);
let socialBindingCounterSigning = $state(false);
let socialBindingPollInterval: ReturnType<typeof setInterval> | null = null;

async function openSocialBindingDrawer() {
    const vault = await globalState.vaultController.vault;
    if (!vault?.ename) return;
    const ename = vault.ename.startsWith("@") ? vault.ename : `@${vault.ename}`;
    socialBindingQr = `w3ds://social_binding?ename=${encodeURIComponent(ename)}`;
    socialBindingSuccess = false;
    socialBindingError = null;
    socialBindingSignerName = null;
    socialBindingSignerEname = null;
    socialBindingPendingDocId = null;
    socialBindingPendingDocParsed = null;
    socialBindingAwaitingConsent = false;
    socialBindingCounterSigning = false;
    showSocialBindingDrawer = true;
    startSocialBindingPolling();
}

function closeSocialBindingDrawer() {
    showSocialBindingDrawer = false;
    stopSocialBindingPolling();
    socialBindingQr = null;
    socialBindingSuccess = false;
    socialBindingError = null;
    socialBindingAwaitingConsent = false;
    socialBindingPendingDocId = null;
    socialBindingPendingDocParsed = null;
    socialBindingSignerName = null;
    socialBindingSignerEname = null;
}

function stopSocialBindingPolling() {
    if (socialBindingPollInterval !== null) {
        clearInterval(socialBindingPollInterval);
        socialBindingPollInterval = null;
    }
    socialBindingPolling = false;
}

async function runSocialBindingPoll() {
    if (
        !showSocialBindingDrawer ||
        socialBindingSuccess ||
        socialBindingCounterSigning ||
        socialBindingAwaitingConsent
    )
        return;
    try {
        const vault = await globalState.vaultController.vault;
        if (!vault?.ename || !vault?.uri) return;
        const callerEname = vault.ename.startsWith("@")
            ? vault.ename
            : `@${vault.ename}`;
        const gqlUrl = new URL("/graphql", vault.uri).toString();

        const unsignedDocs = await fetchUnsignedSocialDocs(gqlUrl, callerEname);
        if (unsignedDocs.length === 0) return;

        const doc = unsignedDocs[0];
        const parsed = doc.node.parsed;
        if (!parsed) return;

        // Stop polling and ask for consent before counter-signing.
        // The signer's eName is whoever already signed the doc (ownerSignature).
        stopSocialBindingPolling();
        const signerEname = parsed.signatures[0]?.signer ?? null;
        if (!signerEname) return;

        socialBindingSignerEname = signerEname;
        socialBindingPendingDocId = doc.node.id;
        socialBindingPendingDocParsed = parsed;

        // Look up the signer's display name from their own vault
        try {
            const signerVaultUri = await resolveVaultUri(signerEname);
            socialBindingSignerName = await fetchNameFromVault(
                signerVaultUri,
                signerEname,
                signerEname,
            );
        } catch {
            socialBindingSignerName = signerEname;
        }

        socialBindingAwaitingConsent = true;
    } catch (err) {
        console.error("[Social Binding] poll error:", err);
    }
}

async function confirmSocialBinding() {
    if (!socialBindingSignerEname) return;
    socialBindingAwaitingConsent = false;
    socialBindingError = null;

    const vault = await globalState.vaultController.vault;
    if (!vault?.ename || !vault?.uri) {
        socialBindingError = "No active vault found.";
        socialBindingAwaitingConsent = false;
        socialBindingCounterSigning = false;
        startSocialBindingPolling();
        return;
    }

    if (!socialBindingPendingDocId || !socialBindingPendingDocParsed) {
        socialBindingError = "No pending social binding request found.";
        socialBindingAwaitingConsent = false;
        socialBindingCounterSigning = false;
        startSocialBindingPolling();
        return;
    }

    socialBindingCounterSigning = true;

    try {
        const callerEname = vault.ename.startsWith("@")
            ? vault.ename
            : `@${vault.ename}`;
        const gqlUrl = new URL("/graphql", vault.uri).toString();

        // Counter-sign the doc in the requester's OWN vault.
        // The doc has subject=@requester (=callerEname) so the requester is the valid counterparty.
        const payload = getCanonicalBindingDocString({
            subject: socialBindingPendingDocParsed.subject,
            type: socialBindingPendingDocParsed.type,
            data: socialBindingPendingDocParsed.data,
        });
        const sig = await globalState.walletSdkAdapter.signPayload(
            "default",
            "default",
            payload,
        );
        await addCounterpartySignature(
            gqlUrl,
            callerEname,
            callerEname,
            socialBindingPendingDocId,
            sig,
        );

        socialBindingSuccess = true;
    } catch (err) {
        console.error("[Social Binding] counter-sign error:", err);
        socialBindingError =
            err instanceof Error ? err.message : "Something went wrong.";
        socialBindingAwaitingConsent = false;
        startSocialBindingPolling();
    } finally {
        socialBindingCounterSigning = false;
    }
}

async function declineSocialBinding() {
    const docId = socialBindingPendingDocId;
    socialBindingAwaitingConsent = false;
    socialBindingPendingDocId = null;
    socialBindingPendingDocParsed = null;
    socialBindingSignerName = null;
    socialBindingSignerEname = null;

    if (docId) {
        try {
            const vault = await globalState.vaultController.vault;
            if (vault?.ename && vault?.uri) {
                const callerEname = vault.ename.startsWith("@")
                    ? vault.ename
                    : `@${vault.ename}`;
                const gqlUrl = new URL("/graphql", vault.uri).toString();
                await deleteSocialBindingDoc(gqlUrl, callerEname, docId);
            }
        } catch (err) {
            console.error(
                "[Social Binding] failed to delete declined doc:",
                err,
            );
        }
    }

    startSocialBindingPolling();
}

function startSocialBindingPolling() {
    socialBindingPolling = true;
    socialBindingPollInterval = setInterval(() => {
        void runSocialBindingPoll();
    }, 3000);
}

onDestroy(() => {
    stopSocialBindingPolling();
});
// ─────────────────────────────────────────────────────────────────────────────

onMount(async () => {
    const userInfo = await globalState.userController.user;
    const isFake = await globalState.userController.isFake;
    docData = (await globalState.userController.document) ?? {};
    userData = { ...userInfo, isFake };

    await loadBindingDocuments();
});
</script>

<AppNav title="ePassport" class="mb-8" />

<div>
    {#if userData}
        <IdentityCard variant="ePassport" {userData} class="shadow-lg" />
    {/if}
    {#if docData}
        <div
            class="p-6 pt-12 bg-gray w-full rounded-2xl -mt-8 flex flex-col gap-2"
        >
            {#each Object.entries(docData) as [fieldName, value]}
                <div class="flex justify-between">
                    <p class="text-black-700 font-normal">{fieldName}</p>
                    <p class="text-black-500 font-medium">{value}</p>
                </div>
            {/each}
        </div>
    {/if}

    {#if bindingDocsLoaded && (hasOnlySelfDocs || missingProvisionerDocs)}
        <div class="mt-6 px-1">
            {#if missingProvisionerDocs}
                <div
                    class="mb-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl"
                >
                    <p class="text-sm font-medium text-emerald-800 mb-1">
                        Upgrade available
                    </p>
                    <p class="text-sm text-emerald-700 leading-relaxed">
                        Your identity is verified locally but your eVault is
                        missing the binding documents to prove it. Add them now
                        to unlock the full trust level.
                    </p>
                </div>
                <ButtonAction class="w-full" callback={startKycUpgrade}>
                    Add Binding Documents
                </ButtonAction>
            {:else}
                <div
                    class="mb-3 p-4 bg-amber-50 border border-amber-200 rounded-xl"
                >
                    <p class="text-sm text-amber-800 leading-relaxed">
                        Your eVault only contains a self-declared binding
                        document. Verify your identity to increase your trust
                        level.
                    </p>
                </div>
                <ButtonAction class="w-full" callback={startKycUpgrade}>
                    Enhance Trust Level
                </ButtonAction>
            {/if}
        </div>
    {/if}

    <!-- Social binding button — always visible once passport is loaded -->
    {#if bindingDocsLoaded}
        <div class="mt-4 px-1">
            <ButtonAction variant="soft" class="w-full" callback={openSocialBindingDrawer}>
                Request Social Binding
            </ButtonAction>
        </div>
    {/if}
</div>

<!-- ── Social binding QR drawer ──────────────────────────────────────────────── -->
{#if showSocialBindingDrawer}
    <div class="fixed inset-0 z-40 bg-black/40" aria-hidden="true"></div>
    <div
        class="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-xl flex flex-col gap-5"
        style="padding: 1.5rem 1.5rem max(1.5rem, env(safe-area-inset-bottom));"
    >
        {#if socialBindingSuccess}
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-lg font-bold">✓</div>
                <h4>Binding Complete!</h4>
            </div>
            <p class="text-black-700">
                {socialBindingSignerName ?? "Someone"} has signed your identity binding.
                Both eVaults now hold a mutually-signed social connection document.
            </p>
            <ButtonAction class="w-full" callback={closeSocialBindingDrawer}>Done</ButtonAction>
        {:else if socialBindingCounterSigning}
            <div class="flex flex-col items-center justify-center gap-4 py-6">
                <Shadow size={36} color="rgb(142, 82, 255)" />
                <p class="text-black-700 text-center">Completing mutual binding…</p>
            </div>
        {:else if socialBindingAwaitingConsent}
            <div>
                <h4 class="mb-1">Social Connection Request</h4>
                <p class="text-black-700">
                    <strong>{socialBindingSignerName ?? socialBindingSignerEname ?? "Someone"}</strong>
                    wants to establish a social connection with you. Accept to confirm the binding.
                </p>
            </div>
            <div class="bg-gray rounded-2xl p-4 flex flex-col gap-1">
                <p class="small text-black-500">From</p>
                <p class="font-semibold">{socialBindingSignerName ?? socialBindingSignerEname}</p>
                {#if socialBindingSignerEname && socialBindingSignerEname !== socialBindingSignerName}
                    <p class="small text-black-300 break-all">{socialBindingSignerEname}</p>
                {/if}
            </div>
            {#if socialBindingError}
                <p class="text-danger">{socialBindingError}</p>
            {/if}
            <div class="flex flex-col gap-3">
                <ButtonAction class="w-full" callback={confirmSocialBinding}>Accept</ButtonAction>
                <ButtonAction variant="soft" class="w-full" callback={declineSocialBinding}>Decline</ButtonAction>
            </div>
        {:else}
            <div>
                <h4 class="mb-1">Request Social Binding</h4>
                <p class="text-black-700">
                    Ask someone with an eID Wallet to scan this QR code to sign your
                    identity binding document.
                </p>
            </div>

            {#if socialBindingQr}
                <div class="flex justify-center py-2">
                    <QrCode value={socialBindingQr} size={220} />
                </div>
                <p class="small text-black-500 text-center break-all">{socialBindingQr}</p>
            {/if}

            {#if socialBindingPolling}
                <div class="flex items-center gap-2 justify-center">
                    <Shadow size={16} color="rgb(142, 82, 255)" />
                    <p class="small text-black-500">Waiting for signature…</p>
                </div>
            {/if}

            {#if socialBindingError}
                <p class="text-danger">{socialBindingError}</p>
            {/if}

            <ButtonAction variant="soft" class="w-full" callback={closeSocialBindingDrawer}>
                Cancel
            </ButtonAction>
        {/if}
    </div>
{/if}

<!-- ── KYC upgrade overlay ───────────────────────────────────────────────────── -->
{#if kycStep !== "idle"}
    {#if kycStep === "checking-hw" || kycStep === "hw-error" || kycStep === "starting" || kycStep === "upgrading"}
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

                    {#if kycError}
                        <div
                            class="bg-[#ff3300] rounded-md p-2 w-full text-center text-white mb-4"
                        >
                            {kycError}
                        </div>
                    {/if}

                    {#if kycStep === "checking-hw" || kycStep === "starting" || kycStep === "upgrading"}
                        <div
                            class="w-full py-20 flex flex-col items-center justify-center gap-6"
                        >
                            <Shadow size={40} color="rgb(142, 82, 255)" />
                            <h4 class="text-center">
                                {kycStep === "checking-hw"
                                    ? "Checking device capabilities..."
                                    : kycStep === "upgrading"
                                      ? "Upgrading your eVault…"
                                      : "Starting verification…"}
                            </h4>
                        </div>
                    {:else if kycStep === "hw-error"}
                        <h4 class="mt-2 mb-2 text-red-600 text-left">
                            Hardware Security Not Available
                        </h4>
                        <p class="text-black-700 mb-4">
                            Your phone doesn't support hardware crypto keys,
                            which is a requirement for verified IDs.
                        </p>
                    {/if}
                </article>

                {#if kycStep === "hw-error"}
                    <div class="flex-none pt-8 pb-12">
                        <ButtonAction
                            variant="soft"
                            class="w-full"
                            callback={resetKyc}
                        >
                            Cancel
                        </ButtonAction>
                    </div>
                {/if}
            </div>
        </div>
    {/if}

    {#if kycStep === "verifying"}
        <div
            class="fixed inset-0 z-50 bg-white flex flex-col"
            style="padding-top: max(16px, env(safe-area-inset-top)); padding-bottom: max(24px, env(safe-area-inset-bottom));"
        >
            <div class="flex-none flex justify-end px-4 pt-2">
                <button
                    class="text-sm text-black-500 underline"
                    onclick={resetKyc}
                >
                    Cancel
                </button>
            </div>
            <div id="didit-container-epassport" class="flex-1 w-full"></div>
        </div>
    {/if}

    {#if kycStep === "duplicate"}
        <div class="fixed inset-0 z-40 bg-black/40" aria-hidden="true"></div>
        <div
            class="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-xl flex flex-col gap-4"
            style="padding: 1.5rem 1.5rem max(1.5rem, env(safe-area-inset-bottom));"
        >
            <div class="flex items-center gap-3">
                <div
                    class="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-lg font-bold"
                >
                    !
                </div>
                <h3 class="text-lg font-bold">Identity Already Registered</h3>
            </div>
            <p class="text-black-700 text-sm leading-relaxed">
                This identity document is already linked to an existing eVault.
                You can't create a duplicate — each person gets one verified
                eVault.
            </p>
            {#if duplicateEName}
                <div class="rounded-xl bg-gray-50 border border-gray-200 p-4">
                    <p class="text-xs text-black-500 mb-1">
                        Your existing eVault eName
                    </p>
                    <p
                        class="font-mono text-sm font-medium text-black-900 break-all"
                    >
                        {duplicateEName}
                    </p>
                </div>
                <p class="text-sm text-black-500">
                    Use the eName above to recover access to your existing
                    eVault instead.
                </p>
            {/if}
            <div class="flex flex-col gap-3 pt-2">
                <ButtonAction variant="soft" class="w-full" callback={resetKyc}>
                    Got it
                </ButtonAction>
            </div>
        </div>
    {/if}

    {#if kycStep === "result"}
        <div class="fixed inset-0 z-40 bg-black/40" aria-hidden="true"></div>
        <div
            class="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-xl flex flex-col gap-4"
            style="padding: 1.5rem 1.5rem max(1.5rem, env(safe-area-inset-bottom));"
        >
            {#if kycError}
                <div
                    class="bg-[#ff3300] rounded-md p-2 w-full text-center text-white text-sm"
                >
                    {kycError}
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
                    Your identity has been verified. Your eVault trust level
                    will now be upgraded.
                </p>
                <div class="flex flex-col gap-3 pt-2">
                    <ButtonAction class="w-full" callback={handleUpgrade}
                        >Continue</ButtonAction
                    >
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
                    Your verification is being manually reviewed. You'll be
                    notified when it's complete.
                </p>
                <div class="flex flex-col gap-3 pt-2">
                    <ButtonAction
                        variant="soft"
                        class="w-full"
                        callback={resetKyc}>Close</ButtonAction
                    >
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
                    <ButtonAction class="w-full" callback={startKycUpgrade}
                        >Try Again</ButtonAction
                    >
                    <ButtonAction
                        variant="soft"
                        class="w-full"
                        callback={resetKyc}>Cancel</ButtonAction
                    >
                </div>
            {/if}
        </div>
    {/if}
{/if}
