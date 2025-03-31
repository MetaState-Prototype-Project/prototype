<script lang="ts">
import SplashScreen from "$lib/fragments/SplashScreen/SplashScreen.svelte";
import { onMount } from "svelte";
import "../app.css";

const { children } = $props();

let showSplashScreen = $state(false);

// replace with actual data loading logic
async function loadData() {
	await new Promise((resolve) => setTimeout(resolve, 1500));
}

async function ensureMinimumDelay() {
	await new Promise((resolve) => setTimeout(resolve, 500));
}

onMount(async () => {
	showSplashScreen = true; // Can't set up the original state to true or animation won't start

	await Promise.all([loadData(), ensureMinimumDelay()]);

	showSplashScreen = false;
});
</script>
    
{#if showSplashScreen}
    <SplashScreen />
{:else}
    {@render children?.()}
{/if}
    