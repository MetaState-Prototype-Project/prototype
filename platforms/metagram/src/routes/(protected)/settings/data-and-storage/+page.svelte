<script>
	import { goto } from '$app/navigation';
	import { SettingsNavigationButton } from '$lib/fragments';
</script>

<div class="flex flex-col gap-3">
	<SettingsNavigationButton onclick={() => goto(`/settings/data-and-storage`)}>
		{#snippet children()}
			Clear cache
		{/snippet}
	</SettingsNavigationButton>
	<hr class="text-grey" />
	<SettingsNavigationButton onclick={() => goto(`/settings/data-and-storage`)}>
		{#snippet children()}
			Download my data
		{/snippet}
	</SettingsNavigationButton>
	<hr class="text-grey" />
	<SettingsNavigationButton onclick={() => goto(`/settings/data-and-storage`)}>
		{#snippet children()}
			Logged in devices
		{/snippet}
	</SettingsNavigationButton>
	<hr class="text-grey" />
</div>
