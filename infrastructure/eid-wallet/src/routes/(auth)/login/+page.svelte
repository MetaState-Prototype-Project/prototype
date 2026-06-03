<script lang="ts">
    import { goto } from "$app/navigation";
    import { keyboardInset } from "$lib/actions/keyboardInset";
    import type { GlobalState } from "$lib/global";
    import { LoadingSheet, PinDots } from "$lib/ui";
    import * as Button from "$lib/ui/Button";
    import { continueAfterSuccessfulAuth } from "$lib/utils/postLogin";
    import {
        type AuthOptions,
        authenticate,
        checkStatus,
    } from "@tauri-apps/plugin-biometric";
    import { getContext, onMount } from "svelte";
    import StepHeader from "../onboarding/steps/StepHeader.svelte";

    // Splash sets this when it has already tried biometric over its own screen.
    // /login then skips re-prompting and just shows the PIN UI.
    const BIOMETRIC_ATTEMPTED_KEY = "biometricAttemptedOnSplash";

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

    const getGlobalState =
        getContext<() => GlobalState | undefined>("globalState");
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

    async function verifyAndAdvance(currentPin: string) {
        if (isPostAuthLoading) return;
        if (!globalState) return;
        if (currentPin.length !== 4) return;

        isError = false;
        isPostAuthLoading = true;

        try {
            const ok = await globalState.securityController.verifyPin(currentPin);
            if (!ok) {
                isError = true;
                pin = "";
                return;
            }

            await continueAfterSuccessfulAuth(globalState);
        } catch (e) {
            console.error("PIN verification failed", e);
            isError = true;
            pin = "";
        } finally {
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

        // If the splash already prompted biometric over its own screen, skip the
        // retry here and let the user enter their PIN. The flag survives the
        // route transition but is single-use.
        const biometricHandledBySplash =
            sessionStorage.getItem(BIOMETRIC_ATTEMPTED_KEY) === "true";
        if (biometricHandledBySplash) {
            sessionStorage.removeItem(BIOMETRIC_ATTEMPTED_KEY);
            return;
        }

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
