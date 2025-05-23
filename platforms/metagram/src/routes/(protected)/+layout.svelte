<script lang="ts">
	import { page } from '$app/state';
	import { BottomNav } from '$lib/fragments';
	import SideBar from '$lib/fragments/SideBar/SideBar.svelte';
	let { children } = $props();

	let route = $derived(page.url.pathname);
</script>

<main class="block h-[100dvh] grid-cols-[22vw_auto_31vw] md:grid">
	<SideBar profileSrc="https://picsum.photos/200" />
	<section>
		{@render children()}
	</section>
	{#if !route.endsWith('/messages')}
		<aside class="hidden border border-y-0 border-s-gray-200 md:block">Right Aside</aside>
	{/if}
	<BottomNav profileSrc="https://picsum.photos/200" />
</main>
