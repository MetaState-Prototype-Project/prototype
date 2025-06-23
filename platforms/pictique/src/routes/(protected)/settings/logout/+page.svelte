<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/ui';
	import { SettingsNavigationButton } from '$lib/fragments';
	import { removeAuthId, removeAuthToken } from '$lib/utils';

	async function handleLogout() {
		removeAuthToken();
		removeAuthId();
		window.location.href = '/auth';
	}
</script>

<div class="flex flex-col gap-3">
	<SettingsNavigationButton
		hasTrailingIcon={false}
		onclick={() => goto(`/settings/data-and-storage`)}
	>
		{#snippet children()}
			<div class="flex flex-col items-start">
				<h2 class="text-black-800 text-base">Do you want to log out?</h2>
				<p class="text-black-600 text-sm">You can log back in anytime</p>
			</div>
		{/snippet}
	</SettingsNavigationButton>
	<hr class="text-grey" />
	<Button size="sm" variant="secondary" callback={handleLogout}>Logout</Button>
</div>