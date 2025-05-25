<script lang="ts">
	import SettingsPage from '$lib/fragments/SettingsPage/SettingsPage.svelte';
	import Aside from '$lib/fragments/SettingsRightAside/Aside.svelte';

	import { page } from '$app/state';
	let { children } = $props();

	const renderSidebar = $derived(page.url.pathname === '/settings');
</script>

<!-- {#if renderSidebar}
	<SettingsPage></SettingsPage>
{:else}
	<Aside />
{/if} -->

<div class="flex flex-col gap-5 px-5 py-2 md:gap-8">
	{@render children()}
</div>
