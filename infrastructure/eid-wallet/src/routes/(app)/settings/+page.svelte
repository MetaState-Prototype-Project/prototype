<script lang="ts">
    import { SettingsNavigationBtn } from "$lib/fragments";
    import { runtime } from "$lib/global/runtime.svelte";
    import {
        Key01Icon,
        LanguageSquareIcon,
        Link02Icon,
        PinCodeIcon,
        Shield01Icon,
    } from "@hugeicons/core-free-icons";
    import { ButtonAction, Drawer } from "$lib/ui";
    import { getContext } from "svelte";
    import type { GlobalState } from "$lib/global";
    import { goto } from "$app/navigation";

    const globalState = getContext<() => GlobalState>("globalState")();

    let isDeleteConfirmationOpen = $state(false);
    let isFinalConfirmationOpen = $state(false);

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

    <p class="w-full py-10 text-center">Version v0.1.8.1</p>
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
