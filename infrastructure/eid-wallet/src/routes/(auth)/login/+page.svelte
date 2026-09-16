<script lang="ts">
import { goto } from "$app/navigation";
import { keyboardInset } from "$lib/actions/keyboardInset";
import type { GlobalState } from "$lib/global";
import { LoadingSheet, PinDots } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import {
    beginAuthPrompt,
    endAuthPrompt,
    isDeepLinkFlowActive,
    isWalletAuthenticated,
    shouldAbortStaleContinuation,
} from "$lib/utils/deepLinkFlow";
import { continueAfterSuccessfulAuth } from "$lib/utils/postLogin";
import { getContext, onDestroy, onMount } from "svelte";
import StepHeader from "../onboarding/steps/StepHeader.svelte";

let pin = $state("");
let isError = $state(false);
let isPostAuthLoading = $state(false);
let hasPendingDeepLink = $state(false);
let pinInput = $state<HTMLInputElement | undefined>(undefined);

// Refocus the hidden PIN input on background taps so the user doesn't have
// to aim for the dots themselves to summon the keyboard. We skip taps that
// land on interactive elements so their own click handlers (Clear PIN, back
// chevron, etc.) still behave normally.
function handleBackgroundClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, [role="button"]')) return;
    pinInput?.focus({ preventScroll: true });
}

const getGlobalState = getContext<() => GlobalState | undefined>("globalState");
let globalState: GlobalState | undefined = $state(undefined);

// An async onMount is not cancelled by unmounting. This one polls for global
// state and then awaits two plugin calls before prompting, so it can still be
// suspended after the splash's own biometric prompt succeeded and routed the
// user onward. Waking up then would fire a SECOND native authenticate() over
// the consent screen and, on success, run a second post-auth routine that
// navigates away from it.
let destroyed = false;
onDestroy(() => {
    destroyed = true;
});

// Snapshot taken when this screen mounts. Reaching /login while the session is
// ALREADY authenticated is normal (a deep-link login authenticates, then a
// guard bounces here), and must still offer biometrics. Only a change from
// unauthenticated to authenticated while we were waiting means another screen
// took over.
const authenticatedAtStart = isWalletAuthenticated();

function superseded(): boolean {
    return shouldAbortStaleContinuation(destroyed, authenticatedAtStart);
}

async function clearPin() {
    if (isPostAuthLoading) return;
    pin = "";
    isError = false;
}

async function verifyAndAdvance(currentPin: string) {
    if (isPostAuthLoading) return;
    if (!globalState) return;
    if (currentPin.length !== 4) return;

    isError = false;
    isPostAuthLoading = true;

    // A deep link arriving mid-verification must not issue its own
    // navigation; continueAfterSuccessfulAuth below owns where we go next.
    beginAuthPrompt();
    try {
        const ok = await globalState.securityController.verifyPin(currentPin);
        if (!ok) {
            isError = true;
            pin = "";
            return;
        }

        // Bracket stays open: continueAfterSuccessfulAuth releases it once it
        // has collected any pending deep link.
        await continueAfterSuccessfulAuth(globalState);
    } catch (e) {
        console.error("PIN verification failed", e);
        isError = true;
        pin = "";
    } finally {
        // Idempotent — already released on the success path.
        endAuthPrompt();
        isPostAuthLoading = false;
    }
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
        if (superseded()) return;
        gs = getGlobalState();
        retries++;
    }
    if (superseded()) return;
    if (!gs) {
        console.error("Global state never became available");
        await goto("/");
        return;
    }
    globalState = gs;

    // Sticky flow flag, not the raw key: the payload may already have been
    // promoted from pendingDeepLink to deepLinkData by the time we mount.
    hasPendingDeepLink = isDeepLinkFlowActive();

    // NOTE: this screen deliberately never calls authenticate(). Biometrics
    // are prompted exclusively from the splash, which only routes here once
    // that prompt has been declined, has failed, or was never available. A
    // second prompt site is what made the dialog's placement non-deterministic
    // — whichever screen won the mount race decided whether the system dialog
    // appeared over the purple splash or over a half-painted PIN pad. /login
    // is now purely the PIN fallback.
});
</script>

<!-- The PIN input is the only meaningful interaction here; keyboard users
     focus it directly via tab. The pointer-only listener just refocuses the
     same input when sighted users tap the background, so there's no
     keyboard interaction worth mirroring. -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<main
    use:keyboardInset
    onclick={handleBackgroundClick}
    class="h-dvh overflow-hidden px-[5vw] flex flex-col bg-white"
    style="padding-top: max(2svh, env(safe-area-inset-top)); padding-bottom: calc(max(16px, env(safe-area-inset-bottom)) + var(--kb-inset, 0px));"
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

    <section class="flex-1 flex flex-col items-center justify-center gap-6">
        <PinDots bind:pin bind:inputEl={pinInput} />

        {#if isError}
            <article class="flex flex-col items-center justify-center gap-2">
                <p class="text-danger text-sm font-medium" role="alert">
                    Your PIN does not match, try again.
                </p>
                <p class="text-black-700 opacity-50 text-sm font-medium">
                    Forgot your pin? <a href="/recover"
                        ><u>Recover your eVault.</u></a
                    >
                </p>
            </article>
        {/if}
    </section>

    <footer class="w-full">
        <Button.Action
            variant="soft"
            class="w-full uppercase tracking-wide"
            callback={clearPin}
        >
            Clear PIN
        </Button.Action>
    </footer>
</main>

<!-- Sign-in spinner — overlays the PIN screen with a blurred backdrop so the
     user has visual context for the step they just completed. -->
<LoadingSheet
    isOpen={isPostAuthLoading}
    title="Signing you in"
    subtitle="Setting things up. This only takes a moment."
/>
