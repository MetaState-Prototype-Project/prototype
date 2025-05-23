<script lang="ts">
	import { page } from '$app/state';
	import { BottomNav, Header } from '$lib/fragments';
	import SideBar from '$lib/fragments/SideBar/SideBar.svelte';
	let { children } = $props();

	let route = $derived(page.url.pathname);
	let heading = $state("");

	$effect(() => {
		switch (route) {
			case "/home":
				heading = "Feed";
				break;
			case "/discover":
				heading = "Search";
				break;
			case "/post":
				heading = "Post";
				break;	
			case "/messages":
				heading = "Messages";
				break;
			case "/settings":
				heading = "Settings";
				break;		
			case "/profile":
				heading = "Profile";
				break;
		}
	})
</script>

<main class="block h-[100dvh] grid-cols-[22vw_auto_31vw] md:grid">
	<SideBar profileSrc="https://picsum.photos/200" handlePost={async () => alert('adas')} />
	<section class="md:pt-10">
		<Header variant="primary" {heading}/>
		{@render children()}
	</section>
	{#if !route.endsWith('/messages')}
		<aside class="hidden border border-y-0 border-s-gray-200 md:block md:pt-14">
			Right Aside
		</aside>
	{/if}
	<BottomNav profileSrc="https://picsum.photos/200" />
</main>
