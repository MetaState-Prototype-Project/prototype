<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { BottomNav, Header } from '$lib/fragments';
	import SideBar from '$lib/fragments/SideBar/SideBar.svelte';
	import { Settings } from '$lib/icons';
	let { children } = $props();

	let route = $derived(page.url.pathname);
	let heading = $state('');

	$effect(() => {
		if (route.includes('home')) {
			heading = 'Feed';
		} else if (route.includes('discover')) {
			heading = 'Search';
		} else if (route.includes('post')) {
			heading = 'Post';
		} else if (route.includes('messages')) {
			heading = 'Messages';
		} else if (route.includes('settings')) {
			heading = 'Settings';
		} else if (route.includes('profile')) {
			heading = 'Profile';
		} else {
			heading = '';
		}
	});
</script>

<main class="block h-[100dvh] grid-cols-[20vw_auto_30vw] md:grid">
	<SideBar profileSrc="https://picsum.photos/200" handlePost={async () => alert('adas')} />
	<section class="mx-4 md:mx-8 md:pt-8">
		<div class="flex items-center justify-between">
			<Header variant="primary" {heading} />
			{#if route === '/profile'}
				<div class="mb-6 flex md:hidden">
					<button
						type="button"
						class="flex items-center gap-2"
						onclick={() => goto(`/settings`)}
					>
						<Settings size="24px" color="var(--color-brand-burnt-orange)" />
					</button>
				</div>
			{/if}
		</div>
		{@render children()}
	</section>
	<BottomNav profileSrc="https://picsum.photos/200" />
</main>
