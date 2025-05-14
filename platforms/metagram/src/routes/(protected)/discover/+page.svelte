<script lang="ts">
	import { activeTab } from '../store.svelte';

	$effect(() => {
		activeTab.value = 'discover';
	});
</script>

<h1>Discover Page</h1>
