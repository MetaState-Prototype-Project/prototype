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

	function currentRoute() {
		const path = route;
		const config = {
			[`/settings/${id}/account`]: { title: 'Account', component: Accounts },
			[`/settings/${id}/notifications`]: { title: 'Notifications', component: Notifications },
			[`/settings/${id}/direct-messages`]: {
				title: 'Direct Messages',
				component: DirectMessages
			},
			[`/settings/${id}/data-and-storage`]: {
				title: 'Data & Storage',
				component: DataStorage
			},
			[`/settings/${id}/support`]: { title: 'Support', component: Support },
			[`/settings/${id}/logout`]: { title: 'Logout', component: Logout }
		};

		return config[path];
	}
</script>

<RightAside>
	{#snippet header()}
		{currentRoute().title}
	{/snippet}
	{#snippet asideContent()}
		<svelte:component this={currentRoute().component} />
	{/snippet}
</RightAside>
