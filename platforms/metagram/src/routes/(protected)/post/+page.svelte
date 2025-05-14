<script lang="ts">
	import { activeTab } from '../store.svelte';

	$effect(() => {
		activeTab.value = 'post';
	});
</script>

<h1>Post</h1>
