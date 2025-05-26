<script lang="ts">
	import { goto } from '$app/navigation';
	import { SettingsNavigationButton } from '$lib/fragments';
	import { Button, Helper, Input, Label } from '$lib/ui';

	let accountPage: 'account' | 'username' | 'emailAdd' | 'changePass' | 'deactivate' = 'account';
	let userEmail: string = 'ananya@auvo.io';
</script>

{#if accountPage === 'account'}
	<div class="flex flex-col gap-3">
		<SettingsNavigationButton onclick={() => (accountPage = 'username')}>
			{#snippet children()}
				Username
			{/snippet}
		</SettingsNavigationButton>
		<hr class="text-grey" />
		<SettingsNavigationButton onclick={() => (accountPage = 'emailAdd')}>
			{#snippet children()}
				Email Address
			{/snippet}
		</SettingsNavigationButton>
		<hr class="text-grey" />
		<SettingsNavigationButton onclick={() => (accountPage = 'changePass')}>
			{#snippet children()}
				Change Password
			{/snippet}
		</SettingsNavigationButton>
		<hr class="text-grey" />
		<SettingsNavigationButton onclick={() => (accountPage = 'deactivate')}>
			{#snippet children()}
				Deactivate Account
			{/snippet}
		</SettingsNavigationButton>
		<hr class="text-grey" />
	</div>
{:else if accountPage === 'username'}
	<div>
		<Label>Change your username</Label>
		<Input type="text" placeholder="Edit Username" />
		<Helper>You can only do this 3 more times</Helper>
	</div>
	<hr class="text-grey" />
	<Button size="sm" variant="secondary" callback={() => alert('saved')}>Save Changes</Button>
{:else if accountPage === 'emailAdd'}
	<div>
		<Label>Your email address</Label>
		<Input type="email" value={userEmail} disabled />
	</div>
{:else if accountPage === 'changePass'}
	<div>
		<Label>Enter Old Password</Label>
		<Input type="password" placeholder="Old Password" />
	</div>
	<div>
		<Label>Enter New Password</Label>
		<Input type="password" placeholder="New Password" />
	</div>
{:else if accountPage === 'deactivate'}
	<div class="flex flex-col gap-3">
		<SettingsNavigationButton
			hasTrailingIcon={false}
			onclick={() => goto(`/settings/data-and-storage`)}
		>
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
{/if}
