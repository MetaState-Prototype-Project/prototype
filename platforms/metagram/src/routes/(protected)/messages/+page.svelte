<script lang="ts">
	import { activeTab } from '../store.svelte';

	$effect(() => {
		activeTab.value = 'messages';
	});
</script>

<h1>Messages</h1>
