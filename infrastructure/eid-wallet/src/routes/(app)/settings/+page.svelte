<script lang="ts">
    import { goto } from "$app/navigation";
    import { SettingsNavigationBtn } from "$lib/fragments";
    import type { GlobalState } from "$lib/global";
    import { runtime } from "$lib/global/runtime.svelte";
    import { ButtonAction, Drawer } from "$lib/ui";
    import {
        Key01Icon,
        LanguageSquareIcon,
        Link02Icon,
        PinCodeIcon,
        Shield01Icon,
    } from "@hugeicons/core-free-icons";
    import { getContext } from "svelte";

    const globalState = getContext<() => GlobalState>("globalState")();

    let isDeleteConfirmationOpen = $state(false);
    let isFinalConfirmationOpen = $state(false);

    // Hidden eVault profile retry functionality
    let tapCount = $state(0);
    let lastTapTime = $state(0);
    let isRetrying = $state(false);
    let retryMessage = $state("");

    function showDeleteConfirmation() {
        isDeleteConfirmationOpen = true;
    }

    function confirmDelete() {
        isDeleteConfirmationOpen = false;
        isFinalConfirmationOpen = true;
    }

    function nukeWallet() {
        globalState.userController.user = undefined;
        globalState.securityController.clearPin();
        isFinalConfirmationOpen = false;
        goto("/onboarding");
    }

    function cancelDelete() {
        isDeleteConfirmationOpen = false;
        isFinalConfirmationOpen = false;
    }

    async function handleVersionTap() {
        const now = Date.now();

        // Reset counter if more than 3 seconds between taps
        if (now - lastTapTime > 3000) {
            tapCount = 0;
        }

        tapCount++;
        lastTapTime = now;

        // Show tap count feedback (only visible to user)
        if (tapCount >= 5) {
            retryMessage = `Taps: ${tapCount}/10`;
        }

        // Trigger eVault profile retry after 10 taps
        if (tapCount === 10) {
            isRetrying = true;
            retryMessage = "Retrying eVault profile setup...";

            try {
                await globalState.vaultController.retryProfileCreation();
                retryMessage =
                    "✅ eVault profile setup completed successfully!";

                // Reset after success
                setTimeout(() => {
                    tapCount = 0;
                    retryMessage = "";
                    isRetrying = false;
                }, 3000);
            } catch (error) {
                console.error("Failed to retry eVault profile setup:", error);
                retryMessage =
                    "❌ Failed to setup eVault profile. Check console for details.";

                // Reset after error
                setTimeout(() => {
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

<main>
    <!-- header part -->
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
        href="/settings/privacy"
    />

    <ButtonAction class="mt-5 w-full" callback={showDeleteConfirmation}
        >Delete Account</ButtonAction
    >

    <!-- Hidden eVault profile retry - tap version 10 times -->
    <div class="w-full py-10 text-center">
        <button
            class="text-gray-500 hover:text-gray-700 transition-colors cursor-pointer select-none"
            on:click={handleVersionTap}
            disabled={isRetrying}
        >
            Version v0.2.1.0
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
</main>

<!-- First Confirmation Drawer -->
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

<!-- Final Confirmation Drawer -->
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
