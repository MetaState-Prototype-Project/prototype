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
				<h2 class="text-black-800 text-base">Do you want to download your data?</h2>
				<p class="text-black-600 text-sm">
					Your data would be sent to the email associated with your account.
				</p>
			</div>
		{/snippet}
	</SettingsNavigationButton>
	<hr class="text-grey" />
	<Button size="sm" variant="secondary" callback={() => alert('Downloaded')}>
		Download Data
	</Button>
</div>
