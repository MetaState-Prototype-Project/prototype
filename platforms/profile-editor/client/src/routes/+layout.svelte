<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '@metastate-foundation/ui/sonner';
	import { initializeAuth, authInitialized } from '$lib/stores/auth';
	import { Skeleton } from '@metastate-foundation/ui/skeleton';

	let { children } = $props();

	onMount(async () => {
		await initializeAuth();
	});
</script>

<ModeWatcher />

{#if $authInitialized}
	{@render children()}
{:else}
	<div class="flex h-screen items-center justify-center">
		<div class="flex flex-col items-center gap-3">
			<Skeleton class="h-8 w-8 rounded-full" />
			<Skeleton class="h-4 w-24" />
		</div>
	</div>
{/if}

<Toaster richColors position="bottom-right" />
