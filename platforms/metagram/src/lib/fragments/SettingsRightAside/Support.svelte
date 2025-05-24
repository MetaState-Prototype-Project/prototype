<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { SettingsNavigationButton } from '..';

	let { id } = page.params;
</script>

<div class="flex flex-col gap-3">
	<SettingsNavigationButton onclick={() => goto(`/settings/${id}/data-and-storage`)}>
		{#snippet children()}
			Report a bug
		{/snippet}
	</SettingsNavigationButton>
	<hr class="text-grey" />
	<SettingsNavigationButton onclick={() => goto(`/settings/${id}/data-and-storage`)}>
		{#snippet children()}
			Send feedback
		{/snippet}
	</SettingsNavigationButton>
	<hr class="text-grey" />
</div>
