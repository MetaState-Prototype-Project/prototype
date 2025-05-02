<script lang="ts">
import SplashScreen from "$lib/fragments/SplashScreen/SplashScreen.svelte";
import { onMount, setContext } from "svelte";
import "../app.css";
import { onNavigate } from "$app/navigation";
import { GlobalState } from "$lib/global/state";

import { runtime } from "$lib/global/runtime.svelte";
import { type Status, checkStatus } from "@tauri-apps/plugin-biometric";

const { children } = $props();

let globalState: GlobalState | undefined = $state(undefined);

let showSplashScreen = $state(false);
let previousRoute = null;
let navigationStack: string[] = [];

setContext("globalState", () => globalState);

// replace with actual data loading logic
async function loadData() {
    await new Promise((resolve) => setTimeout(resolve, 1500));
}

async function ensureMinimumDelay() {
    await new Promise((resolve) => setTimeout(resolve, 500));
}

onMount(async () => {
    let status: Status | undefined = undefined;
    try {
        status = await checkStatus();
    } catch (error) {
        status = {
            biometryType: 0,
            isAvailable: false,
        };
    }
    runtime.biometry = status.biometryType;
    try {
        globalState = await GlobalState.create();
    } catch (error) {
        console.error("Failed to initialize global state:", error);
        // Consider adding fallback behavior or user notification
    }

    showSplashScreen = true; // Can't set up the original state to true or animation won't start
    navigationStack.push(window.location.pathname);

    await Promise.all([loadData(), ensureMinimumDelay()]);

    showSplashScreen = false;
});

onNavigate((navigation) => {
    if (!document.startViewTransition) return;

    const from = navigation.from?.url.pathname;
    const to = navigation.to?.url.pathname;

    if (!from || !to || from === to) return;

    let direction: "left" | "right" = "right";

    const fromIndex = navigationStack.lastIndexOf(from);
    const toIndex = navigationStack.lastIndexOf(to);

    if (toIndex !== -1 && toIndex < fromIndex) {
        // Backward navigation
        direction = "left";
        navigationStack = navigationStack.slice(0, toIndex + 1);
    } else {
        // Forward navigation (or new path)
        direction = "right";
        navigationStack.push(to);
    }

    document.documentElement.setAttribute("data-transition", direction);
    previousRoute = to;

    return new Promise((resolve) => {
        document.startViewTransition(async () => {
            resolve();
            await navigation.complete;
        });
    });
});
</script>

{#if showSplashScreen}
    <SplashScreen />
{:else}
    <div class="bg-white h-[100dvh] overflow-scroll">
        {@render children?.()}
    </div>
{/if}
