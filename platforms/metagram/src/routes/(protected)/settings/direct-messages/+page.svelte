<script lang="ts">
	import { SettingsToggleButton } from '$lib/fragments';
</script>

<div class="flex flex-col gap-3">
	<SettingsToggleButton checked={false}>
		{#snippet children()}
			<div class="flex flex-col items-start">
				<h2 class="text-black-800 text-base">Allow messages from non-followers</h2>
				<p class="text-black-600 text-sm">Anyone can send a DM</p>
			</div>
		{/snippet}
	</SettingsToggleButton>
	<hr class="text-grey" />
</div>
