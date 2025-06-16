<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import SettingsNavigationButton from '$lib/fragments/SettingsNavigationButton/SettingsNavigationButton.svelte';
	import { apiClient } from '$lib/utils';
	import {
		DatabaseIcon,
		Logout01Icon,
		Notification02FreeIcons
	} from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { onMount } from 'svelte';

	let route = $derived(page.url.pathname);
	let username: string = $state('');
	let userEmail: string = $state('');
	let userImage: string = $state('');

	onMount(async () => {
		const { data } = await apiClient.get('/api/users');
		username = data.displayName;
		userEmail = data.handle;
		userImage = data.avatarUrl;
	});
</script>

<div class="bg-grey rounded-xl p-3 md:p-5">
	<SettingsNavigationButton onclick={() => goto(`/settings/account`)} profileSrc={userImage}>
		{#snippet children()}
			<div class="flex flex-col items-start">
				<h2 class="text-lg">{username}</h2>
				<p class="text-sm">{userEmail}</p>
			</div>
		{/snippet}
	</SettingsNavigationButton>
</div>
<hr class="text-grey" />
<div class="flex flex-col gap-3">
	<h3 class="text-brand-burnt-orange text-base font-semibold">Personalisation</h3>
	<div class="{route === `/settings/notifications` ? 'bg-grey' : ''} rounded-xl p-2">
		<SettingsNavigationButton onclick={() => goto(`/settings/notifications`)}>
			{#snippet leadingIcon()}
				<HugeiconsIcon
					size="24px"
					icon={Notification02FreeIcons}
					color="var(--color-brand-burnt-orange)"
				/>
			{/snippet}
			{#snippet children()}
				Notifications
			{/snippet}
		</SettingsNavigationButton>
	</div>
	<div
		class="{route === `/settings/data-and-storage`
			? 'bg-grey'
			: ''} !cursor-not-allowed rounded-xl p-2 opacity-[50%]"
	>
		<SettingsNavigationButton>
			{#snippet leadingIcon()}
				<HugeiconsIcon
					size="24px"
					icon={DatabaseIcon}
					color="var(--color-brand-burnt-orange)"
				/>
			{/snippet}
			{#snippet children()}
				Data & Storage
			{/snippet}
		</SettingsNavigationButton>
	</div>
	<hr class="text-grey" />
	<div class="{route === `/settings/logout` ? 'bg-grey' : ''} rounded-xl p-2">
		<SettingsNavigationButton onclick={() => goto(`/settings/logout`)}>
			{#snippet leadingIcon()}
				<HugeiconsIcon
					size="24px"
					icon={Logout01Icon}
					color="var(--color-brand-burnt-orange)"
				/>
			{/snippet}
			{#snippet children()}
				Logout
			{/snippet}
		</SettingsNavigationButton>
	</div>
</div>
