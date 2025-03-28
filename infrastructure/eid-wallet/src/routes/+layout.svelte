<script lang="ts">
import SplashScreen from "$lib/fragments/SplashScreen/SplashScreen.svelte";
import ButtonAction from "$lib/ui/Button/ButtonAction.svelte";
import "../app.css";
const { children } = $props();

let showSplashScreen = $state(false);

$effect(() => {
	showSplashScreen = true; // needs to happen this way to kickstart the animation
	setTimeout(() => {
		showSplashScreen = false;
	}, 1000);
});
</script>

{#if showSplashScreen}
    <SplashScreen />
{:else}
    {@render children?.()}
{/if}