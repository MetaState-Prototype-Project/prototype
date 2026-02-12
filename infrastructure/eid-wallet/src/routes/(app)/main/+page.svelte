<script lang="ts">
import { goto } from "$app/navigation";
import { Hero, IdentityCard } from "$lib/fragments";
import type { GlobalState } from "$lib/global";
import { AssuranceLevel } from "$lib/global/controllers/user";
import { Drawer, Toast } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import {
    ArrowRight01Icon,
    LinkSquare02Icon,
    QrCodeIcon,
    SecurityCheckIcon,
    SecurityValidationIcon,
    Settings02Icon,
    ShieldKeyIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import { type Snippet, getContext, onMount } from "svelte";
import { onDestroy } from "svelte";
import { Shadow } from "svelte-loading-spinners";
import QrCode from "svelte-qrcode";

let userData: Record<string, unknown> | undefined = $state(undefined);
let greeting: string | undefined = $state(undefined);
let ename: string | undefined = $state(undefined);
let assuranceLevel = $state<AssuranceLevel>(AssuranceLevel.UNVERIFIED);
let profileCreationStatus: "idle" | "loading" | "success" | "failed" =
    $state("idle");

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

onMount(() => {
    // Load initial data
    (async () => {
        const userInfo = await globalState.userController.user;
        const isFake = await globalState.userController.isFake;
        assuranceLevel =
            (await globalState.userController.assuranceLevel) ??
            AssuranceLevel.UNVERIFIED;
        userData = { ...userInfo, isFake, assuranceLevel };
        const vaultData = await globalState.vaultController.vault;
        ename = vaultData?.ename;
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
        <div class="relative">
            <IdentityCard
                variant="ePassport"
                viewBtn={() => goto("/ePassport")}
                userData={userData as Record<string, string>}
            />

            <!-- Show upgrade banner for UNVERIFIED users -->
            {#if assuranceLevel === AssuranceLevel.UNVERIFIED}
                <button
                    onclick={() => {
                        // Emit audit event
                        globalState.vaultController.emitAuditEvent(
                            "KYC_UPGRADE_INITIATED",
                            {
                                source: "epassport_card",
                                timestamp: new Date().toISOString(),
                            },
                        );
                        goto("/verify");
                    }}
                    class="mt-2 w-full bg-linear-to-r from-primary-500 to-primary-300 text-white rounded-3xl p-3 flex items-center justify-between transition-all shadow-md"
                >
                    <div class="flex items-center gap-2">
                        <HugeiconsIcon icon={SecurityCheckIcon} />
                        <div class="text-left">
                            <p class="font-semibold text-sm text-white">
                                Verify Your Identity
                            </p>
                            <p class="text-xs opacity-90 text-white">
                                Unlock all features
                            </p>
                        </div>
                    </div>
                    <HugeiconsIcon icon={ArrowRight01Icon} />
                </button>
            {/if}
        </div>
    {/snippet}

    <main class="pb-12">
        {@render Section("eName", eName)}
        {@render Section("ePassport", ePassport)}

        <Button.Nav
            href="https://marketplace.w3ds.metastate.foundation/"
            target="_blank"
            rel="noopener noreferrer"
            class="rounded-3xl w-full bg-black-700 text-white p-4 mt-8 flex items-center justify-center gap-3 cursor-pointer"
        >
            <span class="text-lg font-medium flex gap-2"
                >Discover <img
                    class="w-12"
                    src="/images/W3DSLogoWhite.svg"
                    alt="w3ds logo"
                /> Post Platforms</span
            >
            <HugeiconsIcon size={24} strokeWidth={2} icon={LinkSquare02Icon} />
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

{#if showToast}
    <Toast message={toastMessage} onClose={handleToastClose} />
{/if}
