<script lang="ts">
	import { SettingsNavigationButton } from '$lib/fragments';
</script>

<div class="flex flex-col gap-3">
	<SettingsNavigationButton>
		{#snippet children()}
			Merul will add things here (as per out discussion)
		{/snippet}
	</SettingsNavigationButton>
	<hr class="text-grey" />
</div>
