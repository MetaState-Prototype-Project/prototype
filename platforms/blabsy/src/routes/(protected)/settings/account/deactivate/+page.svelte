<script>
	import { SettingsNavigationButton } from '$lib/fragments';
	import { Button } from '$lib/ui';
</script>

<div class="flex flex-col gap-3">
	<SettingsNavigationButton hasTrailingIcon={false}>
		{#snippet children()}
			<div class="flex flex-col items-start">
				<h2 class="text-black-800 text-base">
					Are you sure you want to deactivate this account?
				</h2>
				<p class="text-black-600 text-sm">You can log back in anytime</p>
			</div>
		{/snippet}
	</SettingsNavigationButton>
	<hr class="text-grey" />
	<Button size="sm" variant="secondary" callback={() => alert('logout')}>Logout</Button>
</div>
