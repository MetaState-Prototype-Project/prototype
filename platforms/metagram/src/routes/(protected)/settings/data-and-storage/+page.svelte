<script lang="ts">
	import { goto } from '$app/navigation';
	import { SettingsNavigationButton } from '$lib/fragments';
</script>

<div class="flex flex-col gap-3">
	<SettingsNavigationButton onclick={() => goto('/settings/data-and-storage/clear-cache')}>
		{#snippet children()}
			Clear cache
		{/snippet}
	</SettingsNavigationButton>
	<hr class="text-grey" />
	<SettingsNavigationButton onclick={() => goto('/settings/data-and-storage/download-data')}>
		{#snippet children()}
			Download my data
		{/snippet}
	</SettingsNavigationButton>
	<hr class="text-grey" />
	<SettingsNavigationButton onclick={() => goto('/settings/data-and-storage/active-devices')}>
		{#snippet children()}
			Logged in devices
		{/snippet}
	</SettingsNavigationButton>
	<hr class="text-grey" />
</div>
