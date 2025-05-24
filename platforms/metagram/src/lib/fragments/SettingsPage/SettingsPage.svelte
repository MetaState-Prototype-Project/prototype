<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import SettingsNavigationButton from '$lib/fragments/SettingsNavigationButton/SettingsNavigationButton.svelte';
	import {
		CustomerSupportIcon,
		DatabaseIcon,
		Logout01Icon,
		Message01Icon,
		Notification02FreeIcons
	} from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	let route = $derived(page.url.pathname);
	let { id } = page.params;
</script>

<div class="flex flex-col gap-5 px-5 py-2 md:gap-8">
	<div class="bg-grey rounded-xl p-3 md:p-5">
		<SettingsNavigationButton
			onclick={() => goto(`/settings/${id}/account`)}
			profileSrc="https://picsum.photos/200/300"
		>
			{#snippet children()}
				<div class="flex flex-col items-start">
					<h2 class="text-lg">_.ananyayaya._</h2>
					<p class="text-sm">ananya@auvo.io</p>
				</div>
			{/snippet}
		</SettingsNavigationButton>
	</div>
	<hr class="text-grey" />
	<div class="flex flex-col gap-3">
		<h3 class="text-brand-burnt-orange text-base font-semibold">Personalisation</h3>
		<div class="{route === `/settings/${id}/notifications` ? 'bg-grey' : ''} rounded-xl p-2">
			<SettingsNavigationButton onclick={() => goto(`/settings/${id}/notifications`)}>
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
		<div class="{route === `/settings/${id}/direct-messages` ? 'bg-grey' : ''} rounded-xl p-2">
			<SettingsNavigationButton onclick={() => goto(`/settings/${id}/direct-messages`)}>
				{#snippet leadingIcon()}
					<HugeiconsIcon
						size="24px"
						icon={Message01Icon}
						color="var(--color-brand-burnt-orange)"
					/>
				{/snippet}
				{#snippet children()}
					Direct Messages
				{/snippet}
			</SettingsNavigationButton>
		</div>
	</div>
	<hr class="text-grey" />
	<div class="flex flex-col gap-3">
		<h3 class="text-brand-burnt-orange text-base font-semibold">System</h3>
		<div class="{route === `/settings/${id}/data-and-storage` ? 'bg-grey' : ''} rounded-xl p-2">
			<SettingsNavigationButton onclick={() => goto(`/settings/${id}/data-and-storage`)}>
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
		<div class="{route === `/settings/${id}/support` ? 'bg-grey' : ''} rounded-xl p-2">
			<SettingsNavigationButton onclick={() => goto(`/settings/${id}/support`)}>
				{#snippet leadingIcon()}
					<HugeiconsIcon
						size="24px"
						icon={CustomerSupportIcon}
						color="var(--color-brand-burnt-orange)"
					/>
				{/snippet}
				{#snippet children()}
					Support
				{/snippet}
			</SettingsNavigationButton>
		</div>
	</div>
	<hr class="text-grey" />
	<div class="flex flex-col gap-3">
		<div class="{route === `/settings/${id}/logout` ? 'bg-grey' : ''} rounded-xl p-2">
			<SettingsNavigationButton onclick={() => goto(`/settings/${id}/logout`)}>
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
</div>
