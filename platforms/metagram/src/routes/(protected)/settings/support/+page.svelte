<script lang="ts">
	import { goto } from '$app/navigation';
	import { SettingsNavigationButton } from '$lib/fragments';

	let currentPage: 'home' | 'report' | 'feedback' = 'home';
</script>

<div class="flex flex-col gap-3">
	<SettingsNavigationButton onclick={() => goto('/settings/support/report-bug')}>
		{#snippet children()}
			Report a bug
		{/snippet}
	</SettingsNavigationButton>
	<hr class="text-grey" />
	<SettingsNavigationButton onclick={() => goto('/settings/support/feedback')}>
		{#snippet children()}
			Send feedback
		{/snippet}
	</SettingsNavigationButton>
	<hr class="text-grey" />
</div>
