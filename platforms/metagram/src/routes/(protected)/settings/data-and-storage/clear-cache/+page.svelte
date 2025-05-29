<script lang="ts">
	import { goto } from '$app/navigation';
	import { SettingsNavigationButton } from '$lib/fragments';
	import { Button } from '$lib/ui';
</script>

<div class="flex flex-col gap-3">
	<SettingsNavigationButton
		hasTrailingIcon={false}
		onclick={() => goto(`/settings/data-and-storage`)}
	>
		{#snippet children()}
			<div class="flex flex-col items-start">
				<h2 class="text-black-800 text-base">Are you sure you wanna clear cache?</h2>
				<p class="text-black-600 text-sm">
					This would clear the apps cache and free about 14MB of storage
				</p>
			</div>
		{/snippet}
	</SettingsNavigationButton>
	<hr class="text-grey" />
	<Button size="sm" variant="secondary" callback={() => alert('all clear')}>Clear Cache</Button>
</div>
