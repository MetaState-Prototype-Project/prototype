<script lang="ts">
import { goto } from "$app/navigation";
import { SettingsNavigationBtn } from "$lib/fragments";
import type { GlobalState } from "$lib/global";
import { runtime } from "$lib/global/runtime.svelte";
import { AssuranceLevel } from "$lib/global/controllers/user";
import { ButtonAction, Drawer } from "$lib/ui";
import {
    Key01Icon,
    LanguageSquareIcon,
    Link02Icon,
    PinCodeIcon,
    Shield01Icon,
    CheckmarkBadge04Icon,
} from "@hugeicons/core-free-icons";
import { getContext, onMount } from "svelte";
import { onDestroy } from "svelte";

const getGlobalState = getContext<() => GlobalState>("globalState");
const setGlobalState =
    getContext<(value: GlobalState) => void>("setGlobalState");
let globalState = getGlobalState();

let isDeleteConfirmationOpen = $state(false);
let isFinalConfirmationOpen = $state(false);
let assuranceLevel = $state<AssuranceLevel>(AssuranceLevel.UNVERIFIED);

// Hidden eVault profile retry functionality
let tapCount = $state(0);
let lastTapTime = $state(0);
let isRetrying = $state(false);
let retryMessage = $state("");
let timeoutId: ReturnType<typeof setTimeout> | null = null;

onMount(async () => {
    // Load user's assurance level
    assuranceLevel = await globalState.userController.assuranceLevel;
});

function showDeleteConfirmation() {
    isDeleteConfirmationOpen = true;
}

function confirmDelete() {
    isDeleteConfirmationOpen = false;
    isFinalConfirmationOpen = true;
}

async function nukeWallet() {
    const newGlobalState = await globalState.reset();
    setGlobalState(newGlobalState);
    globalState = newGlobalState;
    goto("/onboarding");
}

async function cancelDelete() {
    isDeleteConfirmationOpen = false;
    isFinalConfirmationOpen = false;
    await goto("/main");
}

/**
 * Navigate to KYC verification
 * This allows UNVERIFIED users to upgrade their identity
 */
async function handleVerifyIdentity() {
    console.log("Navigating to KYC verification from Settings");

    // Emit audit event
    globalState.vaultController.emitAuditEvent("KYC_UPGRADE_INITIATED", {
        source: "settings",
        timestamp: new Date().toISOString(),
    });

    await goto("/verify");
}

// Cleanup on unmount
onDestroy(() => {
    if (timeoutId) clearTimeout(timeoutId);
});

async function handleVersionTap() {
    const now = Date.now();

    // Reset if more than 3s between taps
    if (now - lastTapTime > 3000) {
        tapCount = 0;
    }

    tapCount++;
    lastTapTime = now;

    // Show feedback after 5 taps
    if (tapCount >= 5) {
        retryMessage = `Taps: ${tapCount}/10`;
    }

    // Trigger hidden action at 10 taps
    if (tapCount === 10) {
        isRetrying = true;
        retryMessage = "Retrying eVault profile setup...";

        try {
            await globalState.vaultController.retryProfileCreation();
            retryMessage = "✅ eVault profile setup completed successfully!";

            // Clear previous timeout if exists
            if (timeoutId) clearTimeout(timeoutId);

            timeoutId = setTimeout(() => {
                tapCount = 0;
                retryMessage = "";
                isRetrying = false;
            }, 3000);
        } catch (error) {
            console.error("Failed to retry eVault profile setup:", error);
            retryMessage =
                "❌ Failed to setup eVault profile. Check console for details.";

            // Clear previous timeout if exists
            if (timeoutId) clearTimeout(timeoutId);

            timeoutId = setTimeout(() => {
                tapCount = 0;
                retryMessage = "";
                isRetrying = false;
            }, 5000);
        }
    }
}

$effect(() => {
    runtime.header.title = "Settings";
});
</script>

<main class="h-[80svh] flex flex-col justify-between">
    <!-- header part -->
    <div>
        <!-- Show Verify Identity option if user is UNVERIFIED -->
        {#if assuranceLevel === AssuranceLevel.UNVERIFIED}
            <button
                onclick={handleVerifyIdentity}
                class="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-200 dark:border-gray-700"
            >
                <div class="flex items-center gap-3">
                    <div
                        class="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center"
                    >
                        <svg
                            class="w-5 h-5 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                            />
                        </svg>
                    </div>
                    <div class="text-left">
                        <p class="font-semibold text-gray-900 dark:text-white">
                            Verify Identity
                        </p>
                        <p class="text-sm text-gray-600 dark:text-gray-400">
                            Complete KYC to unlock all features
                        </p>
                    </div>
                </div>
                <svg
                    class="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 5l7 7-7 7"
                    />
                </svg>
            </button>
        {/if}

        <SettingsNavigationBtn
            icon={LanguageSquareIcon}
            label="Language"
            href="/settings/language"
        />
        <SettingsNavigationBtn
            icon={PinCodeIcon}
            label="Pin"
            href="/settings/pin"
        />
        <SettingsNavigationBtn
            icon={Shield01Icon}
            label="Privacy"
            href="https://metastate.foundation/"
        />
    </div>
    <div>
        <ButtonAction class="mt-5 w-full" callback={showDeleteConfirmation}
            >Delete Account</ButtonAction
        >

        <!-- Hidden eVault profile retry - tap version 10 times -->
        <div class="w-full py-2 text-center">
            <button
                class="text-gray-500 hover:text-gray-700 transition-colors cursor-pointer select-none"
                onclick={handleVersionTap}
                disabled={isRetrying}
            >
                Version v0.5.0.0
            </button>

            {#if retryMessage}
                <div
                    class="mt-2 text-sm {isRetrying
                        ? 'text-blue-600'
                        : retryMessage.includes('✅')
                          ? 'text-green-600'
                          : 'text-red-600'}"
                >
                    {retryMessage}
                </div>
            {/if}
        </div>
    </div>
</main>

<!-- First Confirmation Drawer -->
{#if isDeleteConfirmationOpen}
    <Drawer bind:isPaneOpen={isDeleteConfirmationOpen}>
        <div class="text-center">
            <h4 class="mt-[2.3svh] mb-[0.5svh] text-red-600">
                ⚠️ Delete Account Warning
            </h4>
            <p class="text-black-700 mb-4">
                Are you sure you want to delete your account? This action will:
            </p>
            <ul class="text-left text-black-700 mb-6 space-y-2">
                <li>• Permanently delete all your personal data</li>
                <li>• Remove your ePassport and eVault access</li>
                <li>• Delete your eName and all associated credentials</li>
                <li>• Make your data inaccessible within 24 hours</li>
                <li>• This action cannot be undone</li>
            </ul>
            <div class="flex gap-3">
                <ButtonAction class="flex-1" callback={cancelDelete}
                    >Cancel</ButtonAction
                >
                <ButtonAction
                    class="flex-1 bg-red-600 hover:bg-red-700"
                    callback={confirmDelete}>Continue</ButtonAction
                >
            </div>
        </div>
    </Drawer>
{/if}

<!-- Final Confirmation Drawer -->
{#if isFinalConfirmationOpen}
    <Drawer bind:isPaneOpen={isFinalConfirmationOpen}>
        <div class="text-center">
            <h4 class="mt-[2.3svh] mb-[0.5svh] text-red-600">
                🚨 Final Confirmation
            </h4>
            <p class="text-black-700 mb-4">
                This is your final warning. Once you confirm:
            </p>
            <div class="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                <p class="text-red-800 font-medium">
                    All your data will be permanently deleted and you will lose
                    access to your ePassport, eVault, and eName forever.
                </p>
            </div>
            <p class="text-black-700 mb-6">
                Are you absolutely certain you want to proceed?
            </p>
            <div class="flex gap-3">
                <ButtonAction class="flex-1" callback={cancelDelete}
                    >Cancel</ButtonAction
                >
                <ButtonAction
                    class="flex-1 bg-red-600 hover:bg-red-700"
                    callback={nukeWallet}>Delete</ButtonAction
                >
            </div>
        </div>
    </Drawer>
{/if}
