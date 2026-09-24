<script lang="ts">
import { goto } from "$app/navigation";
import { SettingsNavigationBtn } from "$lib/fragments";
import type { GlobalState } from "$lib/global";
import { runtime } from "$lib/global/runtime.svelte";
import { m } from "$lib/i18n";
import { clearDeepLink } from "$lib/stores/deepLink";
import { getCurrentLanguage } from "$lib/stores/language.svelte";
import { clearAllNotifications } from "$lib/stores/notifications";
import { BottomSheet, ButtonAction } from "$lib/ui";
import { PinIcon, PrivacyIcon } from "$lib/ui/icons";
import { clearAllCachedPhotos } from "$lib/utils/photoCache";
import { isPermissionGranted } from "@choochmeque/tauri-plugin-notifications-api";
import { FaceIdIcon, Notification02Icon } from "@hugeicons/core-free-icons";
import { checkStatus } from "@tauri-apps/plugin-biometric";
import { getContext } from "svelte";

const getGlobalState = getContext<() => GlobalState>("globalState");
const setGlobalState =
    getContext<(value: GlobalState) => void>("setGlobalState");
const globalState = $derived(getGlobalState());

// The "App Version" subtitle is owned by /settings/+layout.svelte (captured
// at layout init from page.url.pathname). Pushing it through runtime here
// would re-render the OLD AppNav mid- or post-transition and flash.

const currentLanguage = $derived(getCurrentLanguage());

// Hold the probed state, not the label, so the rows re-translate when the
// user switches language without having to re-probe the device.
type RowState = "unknown" | "on" | "off" | "unavailable";
let biometricsState = $state<RowState>("unknown");
let notificationsState = $state<RowState>("unknown");

function rowSubtitle(state: RowState): string {
    if (state === "unavailable") return m.settings_biometrics_unavailable();
    if (state === "on") return m.common_on();
    if (state === "off") return m.common_off();
    return m.settings_tap_to_configure();
}

const biometricsSubtitle = $derived(rowSubtitle(biometricsState));
const notificationsSubtitle = $derived(rowSubtitle(notificationsState));

// Reflect current biometric state in the row subtitle so the user doesn't
// have to open the page to see whether it's on.
$effect(() => {
    if (!globalState) return;
    (async () => {
        try {
            const status = await checkStatus();
            if (!status.isAvailable) {
                biometricsState = "unavailable";
                return;
            }
            const enabled =
                await globalState.securityController.biometricSupport;
            biometricsState = enabled ? "on" : "off";
        } catch {
            biometricsState = "unknown";
        }
    })();
});

// Same subtitle treatment for notifications — surface the OS-level state.
$effect(() => {
    (async () => {
        try {
            notificationsState = (await isPermissionGranted()) ? "on" : "off";
        } catch {
            notificationsState = "unknown";
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
    // goto("/") is an SPA navigation, so sessionStorage survives it.
    clearDeepLink();
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
    runtime.header.title = m.settings_title();
});
</script>

<main class="flex flex-col gap-6 mt-6">
    <SettingsNavigationBtn
        label={m.settings_language()}
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
        label={m.settings_pin_code()}
        subtitle={m.settings_tap_to_change()}
        href="/settings/pin"
    >
        {#snippet iconSlot()}
            <PinIcon size={24} color="var(--color-black-900)" />
        {/snippet}
    </SettingsNavigationBtn>

    <SettingsNavigationBtn
        label={m.settings_biometric_login()}
        subtitle={biometricsSubtitle}
        href="/settings/biometrics"
        icon={FaceIdIcon}
    />

    <SettingsNavigationBtn
        label={m.settings_notifications()}
        subtitle={notificationsSubtitle}
        href="/settings/notifications"
        icon={Notification02Icon}
    />

    <SettingsNavigationBtn
        label={m.settings_privacy_policy()}
        subtitle={m.settings_external_link()}
        href="https://metastate.foundation/privacy"
        onclick={openPrivacy}
    >
        {#snippet iconSlot()}
            <PrivacyIcon size={24} color="var(--color-black-900)" />
        {/snippet}
    </SettingsNavigationBtn>

    <div class="mt-8">
        <ButtonAction variant="soft" class="w-full text-black uppercase text-md" callback={openLogout}>
            {m.settings_logout()}
        </ButtonAction>
    </div>

</main>

<BottomSheet bind:isOpen={isLogoutDrawerOpen}>
    <div class="flex items-start justify-between gap-3">
        <h3 class="text-2xl font-semibold text-black-900">{m.settings_logout()}</h3>
        <button
            type="button"
            onclick={cancelLogout}
            aria-label={m.common_close()}
            class="w-11 h-11 rounded-full bg-black-50 flex items-center justify-center text-black-700 active:opacity-70 shrink-0"
        >
            <span aria-hidden="true" class="text-4xl leading-none">×</span>
        </button>
    </div>
    <p class="text-black-500 leading-snug">
        {m.settings_logout_warning()}
    </p>
    <div class="flex gap-3 mt-2">
        <ButtonAction variant="soft" class="flex-1 text-black uppercase text-lg font-semibold" callback={cancelLogout}
            >{m.common_cancel()}</ButtonAction
        >
        <ButtonAction variant="soft" class="flex-1 text-black uppercase text-lg font-semibold" callback={performLogout}
            >{m.settings_logout()}</ButtonAction
        >
    </div>
</BottomSheet>

