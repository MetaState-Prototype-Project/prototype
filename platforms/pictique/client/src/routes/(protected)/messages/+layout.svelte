<script lang="ts">
	import MainPanel from '$lib/fragments/MainPanel/MainPanel.svelte';

	let { children } = $props();
</script>

<MainPanel>
	{@render children()}
	{#snippet RightPanel()}
		<div></div>
	{/snippet}
</MainPanel>
