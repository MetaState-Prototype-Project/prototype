<script lang="ts">
	import { SettingsNavigationButton } from '$lib/fragments';
	import InputFile from '$lib/fragments/InputFile/InputFile.svelte';
	import { Button, Input, Label } from '$lib/ui';

	let currentPage: 'home' | 'report' | 'feedback' = 'home';
</script>

{#if currentPage === 'home'}
	<div class="flex flex-col gap-3">
		<SettingsNavigationButton onclick={() => (currentPage = 'report')}>
			{#snippet children()}
				Report a bug
			{/snippet}
		</SettingsNavigationButton>
		<hr class="text-grey" />
		<SettingsNavigationButton onclick={() => (currentPage = 'feedback')}>
			{#snippet children()}
				Send feedback
			{/snippet}
		</SettingsNavigationButton>
		<hr class="text-grey" />
	</div>
{:else if currentPage === 'report'}
	<div>
		<Label>What issue are you facing?</Label>
		<Input type="text" placeholder="Describe your issue" />
	</div>
	<hr class="text-grey" />
	<div>
		<Label>Attach a screenshot (optional)</Label>
		<InputFile label="Click to upload a photo"></InputFile>
	</div>
	<hr class="text-grey" />
	<Button size="sm" variant="secondary" callback={() => alert('reported')}>Report bug</Button>
{:else if currentPage === 'feedback'}
	<div>
		<Label>Write to us</Label>
		<Input type="text" placeholder="Send a message" />
	</div>
	<hr class="text-grey" />
	<div>
		<Label>Attach a screenshot (optional)</Label>
		<InputFile label="Click to upload a photo"></InputFile>
	</div>
	<hr class="text-grey" />
	<Button size="sm" variant="secondary" callback={() => alert('sent')}>Send</Button>
{/if}
