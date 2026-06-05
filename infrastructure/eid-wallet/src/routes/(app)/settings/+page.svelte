<script lang="ts">
import { goto } from "$app/navigation";
import { SettingsNavigationBtn } from "$lib/fragments";
import type { GlobalState } from "$lib/global";
import { runtime } from "$lib/global/runtime.svelte";
import {
    getCurrentLanguage,
    subscribe as subscribeLanguage,
} from "$lib/stores/language";
import { clearAllNotifications } from "$lib/stores/notifications";
import { BottomSheet, ButtonAction } from "$lib/ui";
import { PinIcon, PrivacyIcon } from "$lib/ui/icons";
import { clearAllCachedPhotos } from "$lib/utils/photoCache";
import { isPermissionGranted } from "@choochmeque/tauri-plugin-notifications-api";
import { FaceIdIcon, Notification02Icon } from "@hugeicons/core-free-icons";
import { checkStatus } from "@tauri-apps/plugin-biometric";
import { getContext, onMount } from "svelte";

const getGlobalState = getContext<() => GlobalState>("globalState");
const setGlobalState =
    getContext<(value: GlobalState) => void>("setGlobalState");
const globalState = $derived(getGlobalState());

// The "App Version" subtitle is owned by /settings/+layout.svelte (captured
// at layout init from page.url.pathname). Pushing it through runtime here
// would re-render the OLD AppNav mid- or post-transition and flash.

let currentLanguage = $state(getCurrentLanguage());
let biometricsSubtitle = $state("Tap to configure");
let notificationsSubtitle = $state("Tap to configure");
onMount(() =>
    subscribeLanguage(() => {
        currentLanguage = getCurrentLanguage();
    }),
);

// Reflect current biometric state in the row subtitle so the user doesn't
// have to open the page to see whether it's on.
$effect(() => {
    if (!globalState) return;
    (async () => {
        try {
            const status = await checkStatus();
            if (!status.isAvailable) {
                biometricsSubtitle = "Unavailable on this device";
                return;
            }
            const enabled =
                await globalState.securityController.biometricSupport;
            biometricsSubtitle = enabled ? "On" : "Off";
        } catch {
            biometricsSubtitle = "Tap to configure";
        }
    })();
});

// Same subtitle treatment for notifications — surface the OS-level state.
$effect(() => {
    (async () => {
        try {
            const granted = await isPermissionGranted();
            notificationsSubtitle = granted ? "On" : "Off";
        } catch {
            notificationsSubtitle = "Tap to configure";
        }
    })();
});

let isLogoutDrawerOpen = $state(false);

function openLogout() {
    isLogoutDrawerOpen = true;
}

function cancelLogout() {
    isLogoutDrawerOpen = false;
}

// Local-only logout: wipes the wallet's local state via globalState.reset()
// and bounces back to the root splash. Does NOT touch the eVault / provisioner
// backend — re-login on this device requires re-verifying via the standard
// recovery flow.
async function performLogout() {
    isLogoutDrawerOpen = false;
    clearAllNotifications();
    await clearAllCachedPhotos();
    if (!globalState) {
        console.error("Cannot logout: global state not ready");
        return;
    }
    const newGlobalState = await globalState.reset();
    setGlobalState(newGlobalState);
    goto("/");
}

async function openPrivacy(e: Event) {
    e.preventDefault();
    try {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl("https://metastate.foundation/privacy");
    } catch {
        window.location.href = "https://metastate.foundation/privacy";
    }
}

$effect(() => {
    runtime.header.title = "Settings";
});
</script>

<main class="flex flex-col gap-6 mt-6">
    <SettingsNavigationBtn
        label="Language"
        subtitle={currentLanguage.name}
        href="/settings/language"
    >
        {#snippet iconSlot()}
            <span
                class="text-[24px] rounded-full fi fis fi-{currentLanguage.country}"
                aria-hidden="true"
            ></span>
        {/snippet}
    </SettingsNavigationBtn>

    <SettingsNavigationBtn
        label="Pin-Code"
        subtitle="Tap to change"
        href="/settings/pin"
    >
        {#snippet iconSlot()}
            <PinIcon size={24} color="var(--color-black-900)" />
        {/snippet}
    </SettingsNavigationBtn>

    <SettingsNavigationBtn
        label="Biometric login"
        subtitle={biometricsSubtitle}
        href="/settings/biometrics"
        icon={FaceIdIcon}
    />

    <SettingsNavigationBtn
        label="Notifications"
        subtitle={notificationsSubtitle}
        href="/settings/notifications"
        icon={Notification02Icon}
    />

    <SettingsNavigationBtn
        label="Privacy policy"
        subtitle="External link"
        href="https://metastate.foundation/privacy"
        onclick={openPrivacy}
    >
        {#snippet iconSlot()}
            <PrivacyIcon size={24} color="var(--color-black-900)" />
        {/snippet}
    </SettingsNavigationBtn>

    <div class="mt-8">
        <ButtonAction variant="soft" class="w-full text-black uppercase text-md" callback={openLogout}>
            Logout
        </ButtonAction>
    </div>

</main>

<BottomSheet bind:isOpen={isLogoutDrawerOpen}>
    <div class="flex items-start justify-between gap-3">
        <h3 class="text-2xl font-semibold text-black-900">Logout</h3>
        <button
            type="button"
            onclick={cancelLogout}
            aria-label="Close"
            class="w-11 h-11 rounded-full bg-black-50 flex items-center justify-center text-black-700 active:opacity-70 shrink-0"
        >
            <span aria-hidden="true" class="text-4xl leading-none">×</span>
        </button>
    </div>
    <p class="text-black-500 leading-snug">
        Attention: Logging out will unlink this device from your eVault. To
        regain access, you will need to re-verify and confirm some of the
        bindings you provided.
    </p>
    <div class="flex gap-3 mt-2">
        <ButtonAction variant="soft" class="flex-1 text-black uppercase text-lg font-semibold" callback={cancelLogout}
            >Cancel</ButtonAction
        >
        <ButtonAction variant="soft" class="flex-1 text-black uppercase text-lg font-semibold" callback={performLogout}
            >Logout</ButtonAction
        >
    </div>
</BottomSheet>

