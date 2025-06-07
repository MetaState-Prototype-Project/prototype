<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import SettingsNavigationButton from '$lib/fragments/SettingsNavigationButton/SettingsNavigationButton.svelte';
	import {
		DatabaseIcon,
		Logout01Icon,
		Notification02FreeIcons
	} from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	let route = $derived(page.url.pathname);
	let username: string = $state('_.ananyayaya._');
	let userEmail: string = $state('ananya@auvo.io');
	let userImage: string = $state('https://picsum.photos/200/300');
</script>

<div class="rounded-xl bg-black p-3 md:p-5">
	<SettingsNavigationButton
		onclick={() => goto(`/settings/account/username`)}
		profileSrc={userImage}
	>
		{#snippet children()}
			<div class="text-black-200 flex flex-col items-start">
				<h2 class="text-lg">{username}</h2>
				<p class="text-sm">{userEmail}</p>
			</div>
		{/snippet}
	</SettingsNavigationButton>
</div>
<hr class="text-black" />
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
				<p class="text-black-200">Notifications</p>
			{/snippet}
		</SettingsNavigationButton>
	</div>
	<!-- <div class="{route === `/settings/data-and-storage` ? 'bg-grey' : ''} rounded-xl p-2">
		<SettingsNavigationButton onclick={() => goto(`/settings/data-and-storage`)}>
			{#snippet leadingIcon()}
				<HugeiconsIcon
					size="24px"
					icon={DatabaseIcon}
					color="var(--color-brand-burnt-orange)"
				/>
			{/snippet}
			{#snippet children()}
				<p class="text-black-200">Data & Storage</p>
			{/snippet}
		</SettingsNavigationButton>
	</div>
	<hr class="text-black" /> -->
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
				<p class="text-black-200">Logout</p>
			{/snippet}
		</SettingsNavigationButton>
	</div>
</div>
