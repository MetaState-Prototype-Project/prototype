<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { BottomNav, Header } from '$lib/fragments';
	import RightAside from '$lib/fragments/RightAside/RightAside.svelte';
	import Aside from '$lib/fragments/SettingsRightAside/Aside.svelte';
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

	let { id } = page.params;
</script>

<main class="block h-[100dvh] grid-cols-[22vw_auto_31vw] md:grid">
	<SideBar profileSrc="https://picsum.photos/200" handlePost={async () => alert('adas')} />
	<section class="md:pt-8">
		<div class="flex justify-between">
			<Header variant="primary" {heading} />
			{#if route === '/profile'}
				<div class="mb-4 flex pe-5 md:hidden">
					<button
						type="button"
						class="flex items-center gap-2"
						onclick={() => goto(`/settings/${id}`)}
					>
						<Settings size="24px" color="var(--color-brand-burnt-orange)" />
					</button>
				</div>
			{/if}
		</div>
		{@render children()}
	</section>
	{#if route.includes('/settings')}
		<Aside></Aside>
	{:else}
		<aside class="hidden border border-y-0 border-s-gray-200 md:block md:pt-14"></aside>
	{/if}

	<BottomNav profileSrc="https://picsum.photos/200" />
</main>
