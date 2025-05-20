<script lang="ts">
	import { goto } from '$app/navigation';
	import { isNavigatingThroughNav } from '$lib/store/store.svelte';
	import { Button } from '$lib/ui';
</script>

<h1>Home</h1>
<Button
	callback={async () => {
		(isNavigatingThroughNav.value = false), goto('/discover');
	}}>discover</Button
>
