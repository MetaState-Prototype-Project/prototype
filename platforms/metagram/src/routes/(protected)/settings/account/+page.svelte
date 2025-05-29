<script lang="ts">
	import { goto } from '$app/navigation';
	import { SettingsNavigationButton } from '$lib/fragments';
</script>

<div class="flex flex-col gap-3">
	<SettingsNavigationButton onclick={() => goto('/settings/account/username')}>
		{#snippet children()}
			Username
		{/snippet}
	</SettingsNavigationButton>
	<hr class="text-grey" />
	<SettingsNavigationButton onclick={() => goto('/settings/account/deactivate')}>
		{#snippet children()}
			Deactivate Account
		{/snippet}
	</SettingsNavigationButton>
	<hr class="text-grey" />
</div>
