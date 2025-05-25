<script>
	import { goto } from '$app/navigation';
	import { Modal, SettingsNavigationButton } from '$lib/fragments';
</script>

<div class="flex flex-col gap-3">
	<SettingsNavigationButton onclick={() => goto(`/settings/data-and-storage`)}>
		{#snippet children()}
			Username
		{/snippet}
	</SettingsNavigationButton>
	<hr class="text-grey" />
	<SettingsNavigationButton onclick={() => goto(`/settings/data-and-storage`)}>
		{#snippet children()}
			Email Address
		{/snippet}
	</SettingsNavigationButton>
	<hr class="text-grey" />
	<SettingsNavigationButton onclick={() => goto(`/settings/data-and-storage`)}>
		{#snippet children()}
			Change Password
		{/snippet}
	</SettingsNavigationButton>
	<hr class="text-grey" />
	<SettingsNavigationButton onclick={() => goto(`/settings/data-and-storage`)}>
		{#snippet children()}
			Deactivate Account
		{/snippet}
	</SettingsNavigationButton>
	<hr class="text-grey" />
</div>

<Modal>sredfg</Modal>
