<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import { isNavigatingThroughNav } from '$lib/store/store.svelte';
	import '../app.css';

	let { children } = $props();

	let previousRoute = null;

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
</script>

<main class="h-[100dvh] overflow-hidden px-4 md:px-0">
	{@render children()}
</main>
