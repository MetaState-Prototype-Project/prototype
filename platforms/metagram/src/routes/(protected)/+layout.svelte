<script lang="ts">
	import { page } from '$app/state';
	import { BottomNav } from '$lib/fragments';
	let { children } = $props();

	let route = $derived(page.url.pathname);
</script>

<main class="block h-[100dvh] grid-cols-[22vw_auto_31vw] md:grid">
	<aside class="hidden border border-y-0 border-e-gray-200 md:block">Sidebar</aside>
	<section>
		{@render children()}
	</section>
	{#if !route.endsWith('/messages')}
		<aside class="hidden border border-y-0 border-s-gray-200 md:block">Right Aside</aside>
	{/if}
	<BottomNav profileSrc="https://picsum.photos/200" />
</main>
