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
	import type { HTMLAttributes } from 'svelte/elements';

	let route = $derived(page.url.pathname);

	interface ISettingsPageProps extends HTMLAttributes<HTMLElement> {
		handle: string;
		userEmail: string;
	}
	let { handle, userEmail }: ISettingsPageProps = $props();
</script>

<div class="bg-grey rounded-xl p-3 md:p-5">
	<SettingsNavigationButton
		onclick={() => goto(`/settings/account`)}
		profileSrc="https://picsum.photos/200/300"
	>
		<div class="flex flex-col items-start">
			<h2 class="text-lg">{handle}</h2>
			<p class="text-sm">{userEmail}</p>
		</div>
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
			Notifications
		</SettingsNavigationButton>
	</div>
</div>
<hr class="text-grey" />
<div class="flex flex-col gap-3">
	<h3 class="text-brand-burnt-orange text-base font-semibold">System</h3>
	<div class="{route === `/settings/data-and-storage` ? 'bg-grey' : ''} rounded-xl p-2">
		<SettingsNavigationButton onclick={() => goto(`/settings/data-and-storage`)}>
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
