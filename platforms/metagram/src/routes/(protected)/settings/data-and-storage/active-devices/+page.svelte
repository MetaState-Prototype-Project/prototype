<script lang="ts">
	import { SettingsDeleteButton } from '$lib/fragments';
	import { Button } from '$lib/ui';
</script>

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
<Button size="sm" variant="secondary" callback={() => alert('All Deleted')}>
	Logout of all the devices
</Button>
