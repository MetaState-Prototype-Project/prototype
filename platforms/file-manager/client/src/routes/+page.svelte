<script lang="ts">
	import { goto } from '$app/navigation';
	import { isAuthenticated } from '$lib/stores/auth';
	import { onMount } from 'svelte';

	onMount(() => {
		isAuthenticated.subscribe((auth) => {
			if (auth) {
				goto('/files');
			} else {
				goto('/auth');
			}
		});
	});
</script>

<div class="flex items-center justify-center min-h-screen">
	<div class="text-center">
		<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
		<p class="text-gray-600">Loading...</p>
	</div>
</div>

