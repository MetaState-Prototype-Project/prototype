<script lang="ts">
	import { activeTab } from '../store.svelte';

	$effect(() => {
		activeTab.value = 'home';
	});
</script>

<h1>Home</h1>
