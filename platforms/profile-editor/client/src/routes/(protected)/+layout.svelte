<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { isAuthenticated, currentUser } from '$lib/stores/auth';
	import { getAuthToken } from '$lib/utils/axios';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import Header from '$lib/components/layout/Header.svelte';

	let { children } = $props();

	$effect(() => {
		if (!getAuthToken()) {
			goto('/auth');
		}
	});
</script>

{#if $isAuthenticated}
	<div class="flex h-screen bg-background">
		<Sidebar />
		<div class="flex flex-1 flex-col overflow-hidden">
			<Header />
			<main class="flex-1 overflow-y-auto p-6">
				{@render children()}
			</main>
		</div>
	</div>
{/if}
