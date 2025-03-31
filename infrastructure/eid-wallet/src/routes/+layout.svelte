<script lang="ts">
import "../app.css";
const { children } = $props();

let showSplashScreen = $state(true);

$effect(() => {
	setTimeout(() => {
		showSplashScreen = false;
	}, 500);
});
</script>

{#if showSplashScreen}
    <div class="relative w-full h-screen bg-primary">
        <img class="absolute w-full bottom-[-80px] start-0" src="/images/Shape1.svg" alt="illustration">
        <img class="absolute w-full top-[50px] end-[100px]" src="/images/Shape2.svg" alt="illustration">
        <div class="absolute w-full top-[42%] start-[50%] translate-x-[-50%] translate-y-[-42%]">
            <h1 class="text-center text-white text-[44px]">eAgency</h1>
            <p class="text-center text-white">Your self-sovereign digital entity</p>
        </div>
        <img class="absolute bottom-[116px] start-[50%] translate-x-[-50%]" src="/images/W3DSLogoWhite.svg" alt="logo">
    </div>
{:else}
    {@render children?.()}
{/if}