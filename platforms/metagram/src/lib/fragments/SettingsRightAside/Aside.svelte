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
</script>

<RightAside>
	{#snippet header()}
		{#if route === '/settings/asdf/account'}
			Account
		{:else if route === '/settings/asdf/notifications'}
			Notifications
		{:else if route === '/settings/asdf/direct-messages'}
			Direct Messages
		{:else if route === '/settings/asdf/data-and-storage'}
			Data & Storage
		{:else if route === '/settings/asdf/support'}
			Support
		{:else if route === '/settings/asdf/logout'}
			Logout
		{/if}
	{/snippet}
	{#snippet asideContent()}
		{#if route === '/settings/asdf/account'}
			<Accounts></Accounts>
		{:else if route === '/settings/asdf/notifications'}
			<Notifications></Notifications>
		{:else if route === '/settings/asdf/direct-messages'}
			<DirectMessages></DirectMessages>
		{:else if route === '/settings/asdf/data-and-storage'}
			<DataStorage></DataStorage>
		{:else if route === '/settings/asdf/support'}
			<Support></Support>
		{:else if route === '/settings/asdf/logout'}
			<Logout></Logout>
		{/if}
	{/snippet}
</RightAside>
