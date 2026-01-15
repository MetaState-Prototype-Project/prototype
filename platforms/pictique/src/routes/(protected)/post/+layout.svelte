<script lang="ts">
	import MainPanel from '$lib/fragments/MainPanel/MainPanel.svelte';

	let { children } = $props();
</script>

<MainPanel
	><div class="flex flex-col gap-5">
		{@render children()}
	</div>
	{#snippet RightPanel()}
		<div></div>
	{/snippet}
</MainPanel>
