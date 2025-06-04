<script lang="ts">
	import { SettingsToggleButton } from '$lib/fragments';
</script>

<div class="flex flex-col gap-3">
	<SettingsToggleButton checked={false}>
		{#snippet children()}
			<div class="flex flex-col items-start">
				<h2 class="text-black-800 text-base">Push Notifications</h2>
			</div>
		{/snippet}
	</SettingsToggleButton>
	<hr class="text-grey" />
	<SettingsToggleButton checked={false}>
		{#snippet children()}
			<div class="flex flex-col items-start">
				<h2 class="text-black-800 text-base">Post Interactions</h2>
				<p class="text-black-600 text-sm">Likes and comments on your post</p>
			</div>
		{/snippet}
	</SettingsToggleButton>
	<hr class="text-grey" />
	<SettingsToggleButton checked={false}>
		{#snippet children()}
			<div class="flex flex-col items-start">
				<h2 class="text-black-800 text-base">DM Requests</h2>
			</div>
		{/snippet}
	</SettingsToggleButton>
	<hr class="text-grey" />
	<SettingsToggleButton checked={false}>
		{#snippet children()}
			<div class="flex flex-col items-start">
				<h2 class="text-black-800 text-base">New Followers</h2>
			</div>
		{/snippet}
	</SettingsToggleButton>
	<hr class="text-grey" />
</div>
