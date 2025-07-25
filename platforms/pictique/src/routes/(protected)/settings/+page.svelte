<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import SettingsNavigationButton from '$lib/fragments/SettingsNavigationButton/SettingsNavigationButton.svelte';
	import type { userProfile } from '$lib/types';
	import { apiClient, getAuthId } from '$lib/utils';
	import {
		DatabaseIcon,
		Logout01Icon,
		Notification02FreeIcons
	} from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { onMount } from 'svelte';

	let route = $derived(page.url.pathname);
	let ownerId: string | null = $derived(getAuthId());

	let profile = $state<userProfile | null>(null);
	let error = $state<string | null>(null);
	let loading = $state(true);

	async function fetchProfile() {
		try {
			loading = true;
			error = null;
			const response = await apiClient.get(`/api/users/${ownerId}`);
			profile = response.data;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load profile';
		} finally {
			loading = false;
		}
	}
	onMount(fetchProfile);
</script>

<div class="bg-grey rounded-xl p-3 md:p-5">
	{#if loading}
		<div class="flex h-64 items-center justify-center">
			<p class="text-gray-500">Loading profile...</p>
		</div>
	{:else if error}
		<div class="flex h-64 items-center justify-center">
			<p class="text-red-500">{error}</p>
		</div>
	{:else if profile}
		<SettingsNavigationButton
			onclick={() => goto(`/settings/account`)}
			profileSrc={profile?.avatarUrl}
		>
			{console.log(profile)}
			<div class="flex flex-col items-start">
				<h2 class="text-lg">{profile?.handle}</h2>
				<p class="text-sm">{profile?.description}</p>
			</div>
		</SettingsNavigationButton>
	{/if}
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
			Notifications
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
			Data & Storage
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
			Logout
		</SettingsNavigationButton>
	</div>
</div>
