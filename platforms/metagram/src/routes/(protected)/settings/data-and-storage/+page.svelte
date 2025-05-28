<script lang="ts">
	import { goto } from '$app/navigation';
	import { SettingsDeleteButton, SettingsNavigationButton } from '$lib/fragments';
	import { Button } from '$lib/ui';

	let currentPage: 'home' | 'clearCache' | 'downloadData' | 'loggedInDevice' = 'home';
</script>

{#if currentPage === 'home'}
	<div class="flex flex-col gap-3">
		<SettingsNavigationButton onclick={() => (currentPage = 'clearCache')}>
			{#snippet children()}
				Clear cache
			{/snippet}
		</SettingsNavigationButton>
		<hr class="text-grey" />
		<SettingsNavigationButton onclick={() => (currentPage = 'downloadData')}>
			{#snippet children()}
				Download my data
			{/snippet}
		</SettingsNavigationButton>
		<hr class="text-grey" />
		<SettingsNavigationButton onclick={() => (currentPage = 'loggedInDevice')}>
			{#snippet children()}
				Logged in devices
			{/snippet}
		</SettingsNavigationButton>
		<hr class="text-grey" />
	</div>
{:else if currentPage === 'clearCache'}
	<div class="flex flex-col gap-3">
		<SettingsNavigationButton
			hasTrailingIcon={false}
			onclick={() => goto(`/settings/data-and-storage`)}
		>
			{#snippet children()}
				<div class="flex flex-col items-start">
					<h2 class="text-black-800 text-base">Clear cache</h2>
					<p class="text-black-600 text-sm">
						This would clear the apps cache and free about 14MB of storage
					</p>
				</div>
			{/snippet}
		</SettingsNavigationButton>
		<hr class="text-grey" />
		<Button size="sm" variant="secondary" callback={() => alert('all clear')}
			>Clear Cache</Button
		>
	</div>
{:else if currentPage === 'downloadData'}
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
		<Button size="sm" variant="secondary" callback={() => alert('Downloaded')}
			>Download Data</Button
		>
	</div>
{:else if currentPage === 'loggedInDevice'}
	<div class="flex flex-col gap-3">
		<SettingsDeleteButton onclick={() => alert('Deleted')}>
			{#snippet children()}
				<div class="flex flex-col items-start">
					<h2 class="text-black-800 text-base">Google Pixel 8a</h2>
					<p class="text-black-600 text-sm">Last signed in today, 8:23AM</p>
				</div>
			{/snippet}
		</SettingsDeleteButton>
		<hr class="text-grey" />
		<SettingsDeleteButton onclick={() => alert('Deleted')}>
			{#snippet children()}
				<div class="flex flex-col items-start">
					<h2 class="text-black-800 text-base">Apple IPhone 16</h2>
					<p class="text-black-600 text-sm">Last signed in today, 8:23AM</p>
				</div>
			{/snippet}
		</SettingsDeleteButton>
		<hr class="text-grey" />
		<SettingsDeleteButton onclick={() => alert('Deleted')}>
			{#snippet children()}
				<div class="flex flex-col items-start">
					<h2 class="text-black-800 text-base">Google Pixel 8a</h2>
					<p class="text-black-600 text-sm">Last signed in today, 8:23AM</p>
				</div>
			{/snippet}
		</SettingsDeleteButton>
		<hr class="text-grey" />
	</div>
	<Button size="sm" variant="secondary" callback={() => alert('All Deleted')}
		>Logout of all the devices</Button
	>
{/if}
