<script lang="ts">
	import { goto } from '$app/navigation';
	import RightAside from '$lib/fragments/RightAside/RightAside.svelte';
	import SettingsNavigationButton from '$lib/fragments/SettingsNavigationButton/SettingsNavigationButton.svelte';
	import {
		CustomerSupportIcon,
		DatabaseIcon,
		Logout01Icon,
		Message01Icon,
		Notification02FreeIcons
	} from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	let id = 'sdfff';
</script>

<!-- <div class="block h-[100dvh] grid-cols-[auto_31vw] md:grid"> -->
<div class="flex flex-col gap-5 px-5 py-2 md:gap-8">
	<div class="bg-grey rounded-xl p-3 md:p-5">
		<SettingsNavigationButton
			onclick={() => goto('/settings/asdf/account')}
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
	<div class="flex flex-col gap-5">
		<h3 class="text-brand-burnt-orange text-base font-semibold">Personalisation</h3>
		<SettingsNavigationButton onclick={() => goto('/settings/account')}>
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
		<SettingsNavigationButton onclick={() => goto('/settings/account')}>
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
	<hr class="text-grey" />
	<div class="flex flex-col gap-5">
		<h3 class="text-brand-burnt-orange text-base font-semibold">System</h3>
		<SettingsNavigationButton onclick={() => goto('/settings/account')}>
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
		<SettingsNavigationButton onclick={() => goto('/settings/account')}>
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
	<hr class="text-grey" />
	<div class="flex flex-col gap-5">
		<SettingsNavigationButton onclick={() => goto('/settings/account')}>
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
<!-- </div> -->
