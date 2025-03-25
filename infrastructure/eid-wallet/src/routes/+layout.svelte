<script lang="ts">
    import "../app.css"
    const { children } = $props();

    let showSplashScreen = $state(true);

    $effect(() => {
		setTimeout(() => {
			showSplashScreen = false;
		}, 500);
	});
</script>

{#if showSplashScreen}
    <div class="flex items-center justify-center">
        <img class="w-full" src="/images/SplashScreen.svg" alt="splash-screen">
    </div>
{:else}
    {@render children?.()}
{/if}