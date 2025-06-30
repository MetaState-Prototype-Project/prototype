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
    import { ButtonAction } from "$lib/ui";
    import { getContext } from "svelte";
    import type { GlobalState } from "$lib/global";
    import { goto } from "$app/navigation";

    const globalState = getContext<() => GlobalState>("globalState")();

    function nukeWallet() {
        globalState.userController.user = null;
        globalState.securityController.clearPin();
        goto("/onboarding");
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

    <ButtonAction class="mt-5 w-full" callback={nukeWallet}
        >Delete Account</ButtonAction
    >

    <p class="w-full py-10 text-center">Version v0.1.7.2</p>
</main>
