<script lang="ts">
import { goto } from "$app/navigation";
import { Hero } from "$lib/fragments";
import type { GlobalState } from "$lib/global";
import { Drawer, InputPin } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import {
    type AuthOptions,
    authenticate,
    checkStatus,
} from "@tauri-apps/plugin-biometric";
import { getContext, onMount } from "svelte";

let pin = $state("");
let isError = $state(false);
let clearPin = $state(async () => {});
let handlePinInput = $state((pin: string) => {});
let globalState: GlobalState | undefined = $state(undefined);
let hasPendingDeepLink = $state(false);
let isDeletedVaultModalOpen = $state(false);

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

const getGlobalState = getContext<() => GlobalState>("globalState");
const setGlobalState =
    getContext<(value: GlobalState) => void>("setGlobalState");

async function nukeWallet() {
    if (!globalState) return;
    const newGlobalState = await globalState.reset();
    setGlobalState(newGlobalState);
    globalState = newGlobalState;
    isDeletedVaultModalOpen = false;
    await goto("/onboarding");
}

onMount(async () => {
    globalState = getContext<() => GlobalState>("globalState")();
    if (!globalState) {
        console.error("Global state is not defined");
        await goto("/"); // Redirect to home or error page
        return;
    }

    // Check if there's a pending deep link
    const pendingDeepLink = sessionStorage.getItem("pendingDeepLink");
    hasPendingDeepLink = !!pendingDeepLink;
    if (hasPendingDeepLink) {
        console.log("Pending deep link detected on login page");
    }

    clearPin = async () => {
        pin = "";
        isError = false;
    };

    handlePinInput = async (pin: string) => {
        if (pin.length === 4) {
            isError = false;
            const check = globalState
                ? await globalState.securityController.verifyPin(pin)
                : false;
            if (!check) {
                isError = true;
                return;
            }

            // Check eVault health after successful login
            try {
                const vault = await globalState?.vaultController.vault;
                if (vault?.ename && globalState) {
                    const healthCheck =
                        await globalState.vaultController.checkHealth(
                            vault.ename,
                        );
                    if (!healthCheck.healthy) {
                        console.warn(
                            "eVault health check failed:",
                            healthCheck.error,
                        );

                        // If eVault was deleted (404), show modal
                        if (healthCheck.deleted) {
                            isDeletedVaultModalOpen = true;
                            return; // Don't continue to app
                        }
                        // For other errors, continue to app - non-blocking
                    }

                    // Sync public key to eVault core
                    try {
                        await globalState.vaultController.syncPublicKey(
                            vault.ename,
                        );
                    } catch (error) {
                        console.error("Error syncing public key:", error);
                        // Continue to app even if sync fails - non-blocking
                    }
                }
            } catch (error) {
                console.error("Error during eVault health check:", error);
                // Continue to app even if health check fails - non-blocking
            }

            // Check if there's a pending deep link to process
            const pendingDeepLink = sessionStorage.getItem("pendingDeepLink");
            if (pendingDeepLink) {
                try {
                    const deepLinkData = JSON.parse(pendingDeepLink);
                    console.log(
                        "Processing pending deep link after login:",
                        deepLinkData,
                    );

                    // Store the deep link data for the scan page
                    sessionStorage.setItem("deepLinkData", pendingDeepLink);
                    // Clear the pending deep link
                    sessionStorage.removeItem("pendingDeepLink");

                    // Redirect to scan page to process the deep link
                    await goto("/scan-qr");
                    return;
                } catch (error) {
                    console.error("Error processing pending deep link:", error);
                    sessionStorage.removeItem("pendingDeepLink");
                }
            }

            // No pending deep link, go to main page
            await goto("/main");
        }
    };

    // for some reason it's important for this to be done before the biometric stuff
    // otherwise pin doesn't work
    $effect(() => {
        handlePinInput(pin);
    });

    if (
        (await globalState.securityController.biometricSupport) &&
        (await checkStatus()).isAvailable
    ) {
        try {
            await authenticate(
                "You must authenticate with PIN first",
                authOpts,
            );

            // Check eVault health after successful biometric login
            try {
                const vault = await globalState.vaultController.vault;
                if (vault?.ename) {
                    const healthCheck =
                        await globalState.vaultController.checkHealth(
                            vault.ename,
                        );
                    if (!healthCheck.healthy) {
                        console.warn(
                            "eVault health check failed:",
                            healthCheck.error,
                        );

                        // If eVault was deleted (404), show modal
                        if (healthCheck.deleted) {
                            isDeletedVaultModalOpen = true;
                            return; // Don't continue to app
                        }
                        // For other errors, continue to app - non-blocking
                    }

                    // Sync public key to eVault core
                    try {
                        await globalState.vaultController.syncPublicKey(
                            vault.ename,
                        );
                    } catch (error) {
                        console.error("Error syncing public key:", error);
                        // Continue to app even if sync fails - non-blocking
                    }
                }
            } catch (error) {
                console.error("Error during eVault health check:", error);
                // Continue to app even if health check fails - non-blocking
            }

            // Check if there's a pending deep link to process
            const pendingDeepLink = sessionStorage.getItem("pendingDeepLink");
            if (pendingDeepLink) {
                try {
                    const deepLinkData = JSON.parse(pendingDeepLink);
                    console.log(
                        "Processing pending deep link after biometric login:",
                        deepLinkData,
                    );

                    // Store the deep link data for the scan page
                    sessionStorage.setItem("deepLinkData", pendingDeepLink);
                    // Clear the pending deep link
                    sessionStorage.removeItem("pendingDeepLink");

                    // Redirect to scan page to process the deep link
                    await goto("/scan-qr");
                    return;
                } catch (error) {
                    console.error("Error processing pending deep link:", error);
                    sessionStorage.removeItem("pendingDeepLink");
                }
            }

            // No pending deep link, go to main page
            await goto("/main");
        } catch (e) {
            console.error("Biometric authentication failed", e);
        }
    }
});
</script>

<main
    class="h-full pt-[5.2svh] px-[5vw] pb-[4.5svh] flex flex-col justify-between"
>
    <section>
        <Hero title="Log in to your account" class="mb-4">
            {#snippet subtitle()}
                Enter your 4-digit PIN code
            {/snippet}
        </Hero>

        {#if hasPendingDeepLink}
            <div
                class="bg-primary-100 border border-primary-200 rounded-2xl p-4 mb-4"
            >
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <svg
                            class="h-5 w-5 text-primary"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fill-rule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                clip-rule="evenodd"
                            />
                        </svg>
                    </div>
                    <div class="ml-3">
                        <p class="text-sm text-primary">
                            <strong>Authentication Request Pending</strong><br
                            />
                            Complete login to process the authentication request
                        </p>
                    </div>
                </div>
            </div>
        {/if}

        <InputPin bind:pin {isError} onchange={() => handlePinInput(pin)} />
        <p class={`text-danger mt-[3.4svh] ${isError ? "block" : "hidden"}`}>
            Your PIN does not match, try again.
        </p>
    </section>
    <Button.Action class={`w-full`} variant="danger" callback={clearPin}>
        Clear PIN
    </Button.Action>
</main>

<!-- Deleted eVault Modal - Non-dismissible -->
<Drawer bind:isPaneOpen={isDeletedVaultModalOpen} dismissible={false}>
    <div class="text-center">
        <h4 class="mt-[2.3svh] mb-[0.5svh] text-red-600">
            🗑️ eVault Has Been Deleted
        </h4>
        <p class="text-black-700 mb-4">
            Your eVault has been deleted from the registry and is no longer
            accessible.
        </p>
        <div class="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <p class="text-red-800 font-medium">
                To continue using the app, you need to delete your local account
                data and start fresh.
            </p>
        </div>
        <ul class="text-left text-black-700 mb-6 space-y-2">
            <li>• All your local data will be deleted</li>
            <li>• Your ePassport will be removed</li>
            <li>• You will need to onboard again</li>
            <li>• This action cannot be undone</li>
        </ul>
        <p class="text-black-800 mb-4 font-semibold">
            You must delete your local data to continue.
        </p>
        <div class="flex gap-3">
            <Button.Action
                class="flex-1 bg-red-600 hover:bg-red-700"
                callback={nukeWallet}>Delete Local Data</Button.Action
            >
        </div>
    </div>
</Drawer>
