<script lang="ts">
	import { onMount } from 'svelte';
	import axios from 'axios';
	import { PUBLIC_REGISTRY_URL } from '$env/static/public';

	let motd = $state<{ status: 'up' | 'maintenance'; message: string } | null>(null);
	let isDismissed = $state(false);

	const DISMISSED_KEY = 'maintenance-banner-dismissed';

	function checkIfDismissed(message: string): boolean {
		if (typeof window === 'undefined') return false;
		const dismissed = localStorage.getItem(DISMISSED_KEY);
		return dismissed === message;
	}

	function dismissBanner() {
		if (motd?.message) {
			localStorage.setItem(DISMISSED_KEY, motd.message);
			isDismissed = true;
		}
	}

	onMount(async () => {
		try {
			const registryUrl = PUBLIC_REGISTRY_URL || 'http://localhost:4321';
			const response = await axios.get(`${registryUrl}/motd`);
			motd = response.data;

			if (motd?.status === 'maintenance') {
				isDismissed = checkIfDismissed(motd.message);
			}
		} catch (error) {
			console.error('Failed to fetch motd:', error);
		}
	});
</script>

{#if motd?.status === 'maintenance' && !isDismissed}
	<div class="relative bg-yellow-500 px-4 py-3 text-center text-sm font-medium text-black">
		<span>⚠️ {motd.message}</span>
		<button
			onclick={dismissBanner}
			class="absolute right-4 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-700"
			aria-label="Dismiss banner"
		>
			<svg
				class="h-4 w-4"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>
	</div>
{/if}
