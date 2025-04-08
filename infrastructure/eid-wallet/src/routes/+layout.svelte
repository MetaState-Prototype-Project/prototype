<script lang="ts">
import SplashScreen from "$lib/fragments/SplashScreen/SplashScreen.svelte";
import { onMount } from "svelte";
import "../app.css";
import { onNavigate } from "$app/navigation";

const { children } = $props();

let showSplashScreen = $state(false);
let previousRoute = null;
let navigationStack: string[] = [];

// replace with actual data loading logic
async function loadData() {
	await new Promise((resolve) => setTimeout(resolve, 1500));
}

async function ensureMinimumDelay() {
	await new Promise((resolve) => setTimeout(resolve, 500));
}

onMount(async () => {
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
    {@render children?.()}
{/if}
