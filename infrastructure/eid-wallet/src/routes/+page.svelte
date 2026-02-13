<script lang="ts">
import { goto } from "$app/navigation";
import SplashScreen from "$lib/fragments/SplashScreen/SplashScreen.svelte";
import type { GlobalState } from "$lib/global";
import { getContext, onMount } from "svelte";

let globalState: GlobalState | undefined = $state(undefined);
const getGlobalState = getContext<() => GlobalState>("globalState");
let isRedirecting = $state(true);
let initializationFailed = $state(false);

let clearPin = $state(async () => {});
let cleared = $state(false);

onMount(async () => {
    // Get the globalState context function

    // Poll for globalState with extended timeout (12 seconds to exceed layout's 10s timeout)
    const maxRetries = 120; // 12 seconds at 100ms intervals
    let retries = 0;

    const pollInterval = setInterval(() => {
        if (retries >= maxRetries) {
            clearInterval(pollInterval);
            console.error(
                "Global state initialization timed out after 12 seconds",
            );
            initializationFailed = true;
            isRedirecting = false;
            return;
        }

        const state = getGlobalState();
        if (state) {
            globalState = state;
            clearInterval(pollInterval);
        }
        retries++;
    }, 100);
});

// Reactive effect - runs when globalState becomes available
$effect(() => {
    if (!globalState || initializationFailed) return;

    // Run the initialization and routing logic
    (async () => {
        clearPin = async () => {
            try {
                await globalState?.securityController.clearPin();
                cleared = true;
            } catch (error) {
                console.error("Failed to clear PIN:", error);
            }
        };

        try {
            let onboardingComplete = false;
            try {
                onboardingComplete = await globalState.isOnboardingComplete;
            } catch (error) {
                console.error("Failed to determine onboarding status:", error);
            }

            if (
                !onboardingComplete ||
                !(await globalState.userController.user)
            ) {
                await goto("/onboarding");
                return;
            }
            if (!(await globalState.securityController.pinHash)) {
                await goto("/register");
                return;
            }
            await goto("/login");
        } catch (error) {
            console.error("Initialization routing failed:", error);
            initializationFailed = true;
            isRedirecting = false;
        }
    })();
});
</script>

{#if initializationFailed}
    <div class="fixed inset-0 flex items-center justify-center bg-white p-8">
        <div class="max-w-md text-center">
            <div class="mb-4 text-red-500">
                <svg
                    class="w-16 h-16 mx-auto"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
            </div>
            <h2 class="text-xl font-semibold text-gray-900 mb-2">
                Initialization Timeout
            </h2>
            <p class="text-gray-600 mb-6">
                The application failed to start. Please reload the page to try
                again.
            </p>
            <button
                onclick={() => window.location.reload()}
                class="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
                Reload Page
            </button>
        </div>
    </div>
{:else if isRedirecting}
    <div class="fixed inset-0 flex items-center justify-center bg-white">
        <SplashScreen />
    </div>
{/if}
