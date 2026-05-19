<script lang="ts">
import { goto } from "$app/navigation";
import type { GlobalState } from "$lib/global";
import { PinDots } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import {
    type AuthOptions,
    authenticate,
    checkStatus,
} from "@tauri-apps/plugin-biometric";
import { getContext, onMount } from "svelte";
import { Shadow } from "svelte-loading-spinners";
import StepHeader from "../onboarding/steps/StepHeader.svelte";

let pin = $state("");
let isError = $state(false);
let isPostAuthLoading = $state(false);
let hasPendingDeepLink = $state(false);

const getGlobalState = getContext<() => GlobalState | undefined>("globalState");
let globalState: GlobalState | undefined = $state(undefined);

const authOpts: AuthOptions = {
    allowDeviceCredential: false,
    cancelTitle: "Cancel",
    // iOS
    fallbackTitle: "Please enter your PIN",
    // Android
    title: "Login",
    subtitle: "Please authenticate to continue",
    confirmationRequired: true,
};

async function clearPin() {
    if (isPostAuthLoading) return;
    pin = "";
    isError = false;
}

async function continueAfterSuccessfulAuth(gs: GlobalState) {
    try {
        const vault = await gs.vaultController.vault;
        if (vault?.ename) {
            const healthCheck = await gs.vaultController.checkHealth(
                vault.ename,
            );
            if (!healthCheck.healthy) {
                console.warn("eVault health check failed:", healthCheck.error);
                // Non-blocking — continue to the app.
            }

            try {
                await gs.vaultController.syncPublicKey(vault.ename);
            } catch (error) {
                console.error("Error syncing public key:", error);
            }

            try {
                await gs.notificationService.registerDevice(vault.ename);
            } catch (error) {
                console.error(
                    "Error registering device for notifications:",
                    error,
                );
            }
        }
    } catch (error) {
        console.error("Error during eVault health check:", error);
    }

    const pendingDeepLink = sessionStorage.getItem("pendingDeepLink");
    if (pendingDeepLink) {
        try {
            sessionStorage.setItem("deepLinkData", pendingDeepLink);
            sessionStorage.removeItem("pendingDeepLink");
            await goto("/scan-qr");
            return;
        } catch (error) {
            console.error("Error processing pending deep link:", error);
            sessionStorage.removeItem("pendingDeepLink");
        }
    }

    await goto("/main");
}

async function verifyAndAdvance(currentPin: string) {
    if (isPostAuthLoading) return;
    if (!globalState) return;
    if (currentPin.length !== 4) return;

    isError = false;
    isPostAuthLoading = true;

    const ok = await globalState.securityController.verifyPin(currentPin);
    if (!ok) {
        isError = true;
        pin = "";
        isPostAuthLoading = false;
        return;
    }

    await continueAfterSuccessfulAuth(globalState);
}

$effect(() => {
    if (pin.length === 4) verifyAndAdvance(pin);
});

onMount(async () => {
    // Root +layout creates globalState in its own onMount (which runs after
    // children). Poll until it's available — same pattern as (app)/+layout.
    let gs = getGlobalState();
    let retries = 0;
    while (!gs && retries < 50) {
        await new Promise((r) => setTimeout(r, 100));
        gs = getGlobalState();
        retries++;
    }
    if (!gs) {
        console.error("Global state never became available");
        await goto("/");
        return;
    }
    globalState = gs;

    const pendingDeepLink = sessionStorage.getItem("pendingDeepLink");
    hasPendingDeepLink = !!pendingDeepLink;

    // Try biometric first if available.
    if (
        (await gs.securityController.biometricSupport) &&
        (await checkStatus()).isAvailable
    ) {
        try {
            await authenticate(
                "You must authenticate with PIN first",
                authOpts,
            );
            isPostAuthLoading = true;
            await continueAfterSuccessfulAuth(gs);
        } catch (e) {
            console.error("Biometric authentication failed", e);
            isPostAuthLoading = false;
        }
    }
});
</script>

<main
    class="min-h-dvh px-[5vw] flex flex-col bg-white"
    style="padding-top: max(2svh, env(safe-area-inset-top)); padding-bottom: max(16px, env(safe-area-inset-bottom));"
>
    <StepHeader title="Enter your PIN" />

    {#if hasPendingDeepLink && !isPostAuthLoading}
        <div
            class="bg-primary-100 border border-primary-200 rounded-xl px-4 py-2.5 mt-4 text-sm text-primary"
            role="status"
        >
            <strong>Authentication request pending.</strong>
            Sign in to continue.
        </div>
    {/if}

    <section
        class="flex-1 flex flex-col items-center justify-center gap-6"
    >
        {#if isPostAuthLoading}
            <Shadow size={40} color="rgb(142, 82, 255)" />
            <p class="text-primary text-sm">Logging you in…</p>
        {:else}
            <PinDots bind:pin />

            {#if isError}
                <p class="text-danger text-sm font-medium" role="alert">
                    Your PIN does not match, try again.
                </p>
            {/if}
        {/if}
    </section>

    <footer class="w-full">
        {#if !isPostAuthLoading}
            <Button.Action
                variant="soft"
                class="w-full uppercase tracking-wide"
                callback={clearPin}
            >
                Clear PIN
            </Button.Action>
        {/if}
    </footer>
</main>
