<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { initializeAuth, authInitialized } from '$lib/stores/auth';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import '../app.css';

	let authInitComplete = $state(false);

	onMount(async () => {
		if (browser) {
			// Initialize auth and wait for it to complete
			await initializeAuth();
			authInitComplete = true;
		} else {
			// On server, just mark as complete
			authInitComplete = true;
		}
	});
</script>

{#if authInitComplete}
	<slot />
	<ToastContainer />
{:else}
	<div class="flex items-center justify-center min-h-screen bg-gray-50">
		<div class="text-center">
			<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
			<p class="text-gray-600">Loading...</p>
		</div>
	</div>
{/if}

