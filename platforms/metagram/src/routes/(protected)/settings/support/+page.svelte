<script lang="ts">
	import { goto } from '$app/navigation';
	import { SettingsNavigationButton } from '$lib/fragments';
</script>

<div class="flex flex-col gap-3">
	<SettingsNavigationButton onclick={() => goto(`/settings/data-and-storage`)}>
		{#snippet children()}
			Report a bug
		{/snippet}
	</SettingsNavigationButton>
	<hr class="text-grey" />
	<SettingsNavigationButton onclick={() => goto(`/settings/data-and-storage`)}>
		{#snippet children()}
			Send feedback
		{/snippet}
	</SettingsNavigationButton>
	<hr class="text-grey" />
</div>
