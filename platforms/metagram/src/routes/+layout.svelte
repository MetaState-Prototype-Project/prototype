<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import { isNavigatingThroughNav } from '$lib/store/store.svelte';
	import { onMount } from 'svelte';
	import '../app.css';
	import { page } from '$app/state';

	let { children } = $props();

	let previousRoute = null;
	let showSplashScreen = $state(true);

	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		if (!window.matchMedia('(max-width: 768px)').matches) {
			return;
		}

		const currentRoute = navigation.from?.url.pathname;
		const targetRoute = navigation.to?.url.pathname;

		if (currentRoute === targetRoute) {
			return;
		}
		if (!isNavigatingThroughNav.value) {
			const currentDirection = 'right';
			document.documentElement.setAttribute('data-transition', currentDirection);
			previousRoute = targetRoute;
		}

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	onMount(() => {
		setTimeout(() => {
			showSplashScreen = false;
		}, 2500);
	});
</script>

{#if showSplashScreen}
	<main class="grid h-[100dvh] w-full items-center justify-center">
		<img src="/images/Logo.svg" alt="logo" />
	</main>
{:else}
	<main
		class="h-[100dvh] overflow-hidden {page.url.pathname.includes('/profile')
			? 'px-0'
			: 'px-4'}  md:px-0"
	>
		{@render children()}
	</main>
{/if}
