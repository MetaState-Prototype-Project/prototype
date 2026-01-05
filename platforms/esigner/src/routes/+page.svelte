<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { isAuthenticated, initializeAuth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';

	onMount(async () => {
		if (browser) {
			// Wait for auth to initialize
			const authInitialized = await initializeAuth();
			
			// Then check auth status and redirect
			if (authInitialized) {
				goto('/files');
			} else {
				goto('/auth');
			}
		}
	});
</script>

<div class="flex items-center justify-center min-h-screen">
	<p>Loading...</p>
</div>


