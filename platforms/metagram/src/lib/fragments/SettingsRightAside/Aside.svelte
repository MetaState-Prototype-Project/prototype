<script lang="ts">
	import { page } from '$app/state';
	import { RightAside } from '..';
	import Accounts from './Accounts.svelte';
	import DataStorage from './DataStorage.svelte';
	import DirectMessages from './DirectMessages.svelte';
	import Logout from './Logout.svelte';
	import Notifications from './Notifications.svelte';
	import Support from './Support.svelte';

	let route = $derived(page.url.pathname);
	let { id } = page.params;

	const basePath = `/settings/${id}`;
	const routes = {
		account: { title: 'Account', component: Accounts },
		notifications: { title: 'Notifications', component: Notifications },
		'direct-messages': { title: 'Direct Messages', component: DirectMessages },
		'data-and-storage': { title: 'Data & Storage', component: DataStorage },
		support: { title: 'Support', component: Support },
		logout: { title: 'Logout', component: Logout }
	};
	const currentView = $derived(
		Object.entries(routes).find(([key]) => route === `${basePath}/${key}`)
	);
</script>

<RightAside>
	{#snippet header()}
		{currentView?.[1].title}
	{/snippet}

	{#snippet asideContent()}
		{#if currentView}
			{@const Component = currentView[1].component}
			<Component />
		{/if}
	{/snippet}
</RightAside>
