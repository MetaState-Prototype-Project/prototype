<script lang="ts">
import { goto } from "$app/navigation";
import { PUBLIC_EID_WALLET_TOKEN, PUBLIC_PROVISIONER_URL } from "$env/static/public";
import { Hero, IdentityCard } from "$lib/fragments";
import { capitalize } from "$lib/utils";
import type { GlobalState } from "$lib/global";
import { Drawer, Toast } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import {
    LinkSquare02Icon,
    QrCodeIcon,
    Settings02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import axios from "axios";
import { type Snippet, getContext, onMount } from "svelte";
import { onDestroy } from "svelte";
import { Shadow } from "svelte-loading-spinners";
import QrCode from "svelte-qrcode";

let userData: Record<string, unknown> | undefined = $state(undefined);
let greeting: string | undefined = $state(undefined);
let ename: string | undefined = $state(undefined);
let profileCreationStatus: "idle" | "loading" | "success" | "failed" =
    $state("idle");

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

let kycStep = $state<KycStep>("idle");
let kycError = $state<string | null>(null);
let diditActualSessionId = $state<string | null>(null);
let diditDecision = $state<any>(null);
let diditResult = $state<"approved" | "declined" | "in_review" | null>(null);
let diditRejectionReason = $state<string | null>(null);
let duplicateEName = $state<string | null>(null);
// ─────────────────────────────────────────────────────────────────────────────

let shareQRdrawerOpen = $state(false);
let statusInterval: ReturnType<typeof setInterval> | undefined =
    $state(undefined);
let showToast = $state(false);
let toastMessage = $state("");

function shareQR() {
    alert("QR Code shared!");
    shareQRdrawerOpen = false;
}

async function copyEName() {
    if (!ename) return;
    try {
        await navigator.clipboard.writeText(ename);
        toastMessage = "eName copied to clipboard!";
        showToast = true;
    } catch (error) {
        console.error("Failed to copy eName:", error);
        toastMessage = "Failed to copy eName";
        showToast = true;
    }
}

function handleToastClose() {
    showToast = false;
}

async function retryProfileCreation() {
    try {
        await globalState.vaultController.retryProfileCreation();
    } catch (error) {
        console.error("Retry failed:", error);
    }
}

const globalState = getContext<() => GlobalState>("globalState")();

async function loadBindingDocuments(): Promise<void> {
    const vault = await globalState.vaultController.vault;
    if (!vault?.uri || !vault?.ename) {
        bindingDocsLoaded = true;
        return;
    }

    const enameHeader = vault.ename.startsWith("@") ? vault.ename : `@${vault.ename}`;
    const gqlUrl = new URL("/graphql", vault.uri).toString();

    try {
        const res = await fetch(gqlUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-ENAME": enameHeader,
                ...(PUBLIC_EID_WALLET_TOKEN
                    ? { Authorization: `Bearer ${PUBLIC_EID_WALLET_TOKEN}` }
                    : {}),
            },
            body: JSON.stringify({
                query: `query {
                    bindingDocuments(first: 50) {
                        edges { node { parsed } }
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

        // Verified identity locally (isFake=false) but provisioner binding docs missing
        missingProvisionerDocs =
            !isFake &&
            !types.includes("id_document") &&
            !types.includes("photograph");
    } catch (err) {
        console.warn("[main] Failed to load binding documents:", err);
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
            new URL("/verification", PUBLIC_PROVISIONER_URL).toString(),
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
                embeddedContainerId: "didit-container-home",
            },
        });
    } catch (err) {
        console.error("[KYC] Failed to start:", err);
        kycError = err instanceof Error ? err.message : "Failed to start verification. Please try again.";
        kycStep = "idle";
        setTimeout(() => { kycError = null; }, 6000);
    }
}

const handleDiditComplete = async (result: any) => {
    console.log("[KYC] onComplete:", result);

    if (result.type === "cancelled") {
        resetKyc();
        return;
    }

    if (!result.session?.sessionId) {
        kycError = "Verification did not return a session ID.";
        resetKyc();
        return;
    }

    diditActualSessionId = result.session.sessionId;
    kycStep = "starting"; // reuse "starting" as a loading state while fetching decision

    try {
        const { data: decision } = await axios.get(
            new URL(
                `/verification/decision/${result.session.sessionId}`,
                PUBLIC_PROVISIONER_URL,
            ).toString(),
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
                decision.id_verifications?.[0]?.warnings?.[0]?.short_description ??
                "Verification could not be completed.";
        }

        kycStep = "result";
    } catch (err) {
        console.error("[KYC] Failed to fetch decision:", err);
        kycError = "Failed to retrieve verification result. Please try again.";
        resetKyc();
        setTimeout(() => { kycError = null; }, 6000);
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

    const sessionId = diditActualSessionId ?? diditDecision.session_id ?? diditDecision.session?.sessionId;
    if (!sessionId) {
        kycError = "Missing session ID from verification result.";
        return;
    }

    kycStep = "upgrading";
    try {
        const { data } = await axios.post(
            new URL("/verification/upgrade", PUBLIC_PROVISIONER_URL).toString(),
            { diditSessionId: sessionId, w3id },
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
            const fullName = (idVerif.full_name ?? `${idVerif.first_name ?? ""} ${idVerif.last_name ?? ""}`).trim();
            const dob: string = idVerif.date_of_birth ?? "";
            const docType: string = idVerif.document_type ?? "";
            const docNumber: string = idVerif.document_number ?? "";
            const country: string = idVerif.issuing_state_name ?? idVerif.issuing_state ?? "";
            const expiryDate: string = idVerif.expiration_date ?? "";
            const issueDate: string = idVerif.date_of_issue ?? "";

            globalState.userController.user = {
                name: capitalize(fullName),
                "Date of Birth": dob ? new Date(dob).toDateString() : "",
                "ID submitted": [docType, country].filter(Boolean).join(" - ") || "Verified",
                "Document Number": docNumber,
            };
            globalState.userController.document = {
                "Valid From": issueDate ? new Date(issueDate).toDateString() : "",
                "Valid Until": expiryDate ? new Date(expiryDate).toDateString() : "",
                "Verified On": new Date().toDateString(),
            };
            globalState.userController.isFake = false;

            // Refresh local userData so the card re-renders immediately
            const userInfo = await globalState.userController.user;
            userData = { ...userInfo, isFake: false };
        }

        resetKyc();
        // Refresh binding docs so ribbon disappears
        bindingDocsLoaded = false;
        hasOnlySelfDocs = false;
        missingProvisionerDocs = false;
        await loadBindingDocuments();
    } catch (err: any) {
        console.error("[KYC] Upgrade failed:", err);
        const body = err?.response?.data;
        if (body?.duplicate) {
            duplicateEName = body.existingW3id ?? null;
            kycStep = "duplicate";
        } else {
            kycError = body?.message ?? (err instanceof Error ? err.message : "Upgrade failed. Please try again.");
            kycStep = "result";
            setTimeout(() => { kycError = null; }, 6000);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────

onMount(() => {
    // Load initial data
    (async () => {
        const userInfo = await globalState.userController.user;
        const isFake = await globalState.userController.isFake;
        userData = { ...userInfo, isFake };
        const vaultData = await globalState.vaultController.vault;
        ename = vaultData?.ename;
        await loadBindingDocuments();
    })();

    // Get initial profile creation status
    profileCreationStatus = globalState.vaultController.profileCreationStatus;
    console.log("status current", profileCreationStatus);

    // Set up a watcher for profile creation status changes
    const checkStatus = () => {
        profileCreationStatus =
            globalState.vaultController.profileCreationStatus;
    };

    // Check status periodically
    statusInterval = setInterval(checkStatus, 1000);

    const currentHour = new Date().getHours();
    greeting =
        currentHour > 17
            ? "Good Evening"
            : currentHour > 12
              ? "Good Afternoon"
              : "Good Morning";
});

onDestroy(() => {
    if (statusInterval) {
        clearInterval(statusInterval);
    }
});
</script>

{#if profileCreationStatus === "loading"}
    <div class="flex flex-col items-center justify-center min-h-screen gap-6">
        <Shadow size={40} color="rgb(142, 82, 255);" />
        <h3 class="text-xl font-semibold">Setting up your eVault profile</h3>
        <p class="text-black-700 text-center max-w-md">
            We're creating your profile in the eVault. This may take a few
            moments...
        </p>
    </div>
{:else if profileCreationStatus === "failed"}
    <div
        class="flex flex-col items-center justify-center min-h-screen gap-6 px-4"
    >
        <div class="text-center">
            <h3 class="text-xl font-semibold text-danger mb-2">
                Profile Setup Failed
            </h3>
            <p class="text-black-700 text-center max-w-md mb-6">
                We couldn't set up your eVault profile. This might be due to a
                network issue or temporary service unavailability.
            </p>
            <Button.Action
                variant="solid"
                callback={retryProfileCreation}
                class="w-full max-w-xs"
            >
                Try Again
            </Button.Action>
        </div>
    </div>
{:else}
    <div class="flex items-start">
        <Hero title={greeting ?? "Hi!"}>
            {#snippet subtitle()}
                Welcome back to your eID Wallet
            {/snippet}
        </Hero>

        <Button.Nav href="/settings">
            <HugeiconsIcon
                size={32}
                strokeWidth={2}
                className="mt-1.5"
                icon={Settings02Icon}
            />
        </Button.Nav>
    </div>

    {#snippet Section(title: string, children: Snippet)}
        <section class="mt-5">
            <h4>{title}</h4>
            {@render children()}
        </section>
    {/snippet}

    {#snippet eName()}
        <IdentityCard
            variant="eName"
            userId={ename ?? "Loading..."}
            copyBtn={copyEName}
        />
    {/snippet}
    {#snippet ePassport()}
        <IdentityCard
            variant="ePassport"
            viewBtn={() => goto("/ePassport")}
            userData={userData as Record<string, string>}
        />
    {/snippet}

    <main class="pb-12">
        {@render Section("eName", eName)}

        <!-- ePassport section: whole block navigates to /ePassport -->
        <section class="mt-5">
            <h4>ePassport</h4>
            <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
            <div
                class="cursor-pointer relative"
                onclick={() => goto("/ePassport")}
                role="link"
                tabindex="0"
                onkeydown={(e) => { if (e.key === "Enter") goto("/ePassport"); }}
            >
                <div class="relative z-10">
                    <IdentityCard
                        variant="ePassport"
                        userData={userData as Record<string, string>}
                    />
                </div>
                {#if bindingDocsLoaded && (hasOnlySelfDocs || missingProvisionerDocs)}
                    <button
                        onclick={(e) => { e.stopPropagation(); goto("/ePassport"); }}
                        class="relative z-0 w-full -mt-3 -translate-y-[10px] rounded-b-2xl px-4 pt-[30px] pb-3 flex items-center justify-center gap-2 text-sm font-medium shadow-md transition-colors
                            {missingProvisionerDocs
                                ? 'bg-emerald-400 text-emerald-900 active:bg-emerald-500'
                                : 'bg-amber-400 text-amber-900 active:bg-amber-500'}"
                    >
                        <span>{missingProvisionerDocs ? '↑' : '⚠'}</span>
                        {missingProvisionerDocs
                            ? 'New — upgrade your eVault with verified identity docs'
                            : 'Tap to verify your identity and increase trust level'}
                    </button>
                {/if}
            </div>
        </section>

        <Button.Nav
            href="https://marketplace.w3ds.metastate.foundation/"
            target="_blank"
            rel="noopener noreferrer"
            class="rounded-3xl z-0 w-full border border-gray-300 h-48 text-black p-3 mt-8 flex flex-col justify-end cursor-pointer relative overflow-hidden  transition-shadow"
        >
            <img
                src="/marketplace.png"
                alt="Marketplace"
                class="absolute inset-0 z-0 w-full h-full object-cover object-bottom"
            />
            <!-- Gradient overlay that fades towards the bottom -->
            <div
                class="absolute inset-0 z-1 bg-linear-to-t from-white via-white/60 to-transparent"
            ></div>

            <span
                class="text-2xl font-bold flex gap-2 relative z-10 drop-shadow-lg"
                >Discover Post Platforms</span
            >
            <span
                class="text-sm opacity-90 relative z-10 drop-shadow-md flex gap-1 items-center"
                >Explore
                <img
                    src="/images/W3DSLogoBlack.svg"
                    alt="W3DS Logo"
                    class="h-4"
                />
                Marketplace
                <span class="relative z-10">
                    <HugeiconsIcon
                        size={16}
                        strokeWidth={1.5}
                        icon={LinkSquare02Icon}
                    />
                </span></span
            >
        </Button.Nav>
    </main>

    <Drawer
        title="Scan QR Code"
        bind:isPaneOpen={shareQRdrawerOpen}
        class="flex flex-col gap-4 items-center justify-center"
    >
        <div
            class="flex justify-center relative items-center overflow-hidden h-full rounded-3xl p-8 pt-0"
        >
            <QrCode size={320} value={ename ?? ""} />
        </div>

        <h4 class="text-center mt-2">Share your eName</h4>
        <p class="text-black-700 text-center">
            Anyone scanning this can see your eName
        </p>
        <div class="flex justify-center items-center mt-4">
            <Button.Action variant="solid" callback={shareQR} class="w-full">
                Share
            </Button.Action>
        </div>
    </Drawer>

    <Button.Nav
        href="/scan-qr"
        class="fixed bottom-12 left-1/2 -translate-x-1/2"
    >
        <Button.Action
            variant="solid"
            size="md"
            onclick={() => alert("Action button clicked!")}
            class="mx-auto text-nowrap flex gap-8"
        >
            <HugeiconsIcon
                size={32}
                strokeWidth={2}
                className="mr-2"
                icon={QrCodeIcon}
            />
            Scan to Login
        </Button.Action>
    </Button.Nav>
{/if}

<!-- ── KYC upgrade overlay ───────────────────────────────────────────────────── -->
{#if kycStep !== "idle"}
    <!-- Hardware check / hw-error / starting (loading) -->
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
                        <p class="text-black-700">
                            Hardware-backed identity verification is not
                            available on this device.
                        </p>
                    {/if}
                </article>

                {#if kycStep === "hw-error"}
                    <div class="flex-none pt-8 pb-12">
                        <Button.Action
                            variant="soft"
                            class="w-full"
                            callback={resetKyc}
                        >
                            Cancel
                        </Button.Action>
                    </div>
                {/if}
            </div>
        </div>
    {/if}

    <!-- Didit embedded verification -->
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
            <div id="didit-container-home" class="flex-1 w-full"></div>
        </div>
    {/if}

    <!-- Duplicate detected sheet -->
    {#if kycStep === "duplicate"}
        <div class="fixed inset-0 z-40 bg-black/40" aria-hidden="true"></div>
        <div
            class="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-xl flex flex-col gap-4"
            style="padding: 1.5rem 1.5rem max(1.5rem, env(safe-area-inset-bottom));"
        >
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-lg font-bold">!</div>
                <h3 class="text-lg font-bold">Identity Already Registered</h3>
            </div>
            <p class="text-black-700 text-sm leading-relaxed">
                This identity document is already linked to an existing eVault. You can't create a duplicate — each person gets one verified eVault.
            </p>
            {#if duplicateEName}
                <div class="rounded-xl bg-gray-50 border border-gray-200 p-4">
                    <p class="text-xs text-black-500 mb-1">Your existing eVault eName</p>
                    <p class="font-mono text-sm font-medium text-black-900 break-all">{duplicateEName}</p>
                </div>
                <p class="text-sm text-black-500">
                    Use the eName above to recover access to your existing eVault instead.
                </p>
            {/if}
            <div class="flex flex-col gap-3 pt-2">
                <Button.Action variant="soft" class="w-full" callback={resetKyc}>
                    Got it
                </Button.Action>
            </div>
        </div>
    {/if}

    <!-- Result bottom sheet -->
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
                    <Button.Action class="w-full" callback={handleUpgrade}>
                        Continue
                    </Button.Action>
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
                    <Button.Action variant="soft" class="w-full" callback={resetKyc}>
                        Close
                    </Button.Action>
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
                    <Button.Action class="w-full" callback={startKycUpgrade}>
                        Try Again
                    </Button.Action>
                    <Button.Action variant="soft" class="w-full" callback={resetKyc}>
                        Cancel
                    </Button.Action>
                </div>
            {/if}
        </div>
    {/if}
{/if}

{#if showToast}
    <Toast message={toastMessage} onClose={handleToastClose} />
{/if}
