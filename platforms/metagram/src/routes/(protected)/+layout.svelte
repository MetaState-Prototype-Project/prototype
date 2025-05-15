<script lang="ts">
	import { BottomNav } from '$lib/fragments';
	import { activeTab } from './store.svelte';

	let { children } = $props();
</script>

<main>
	{@render children()}
	<BottomNav bind:activeTab={activeTab.value} profileSrc="https://picsum.photos/200" />
</main>
