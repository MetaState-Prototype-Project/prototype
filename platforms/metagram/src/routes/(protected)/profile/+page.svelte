<script lang="ts">
	import { activeTab } from '../store.svelte';

	$effect(() => {
		activeTab.value = 'profile';
	});
</script>

<h1>Profile</h1>
