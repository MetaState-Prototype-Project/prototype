<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ButtonAction } from '$lib/ui';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { RefreshFreeIcons } from '@hugeicons/core-free-icons';
	import '../app.css';

	let { children } = $props();
	let pageUrl = $derived(page.url.pathname);
</script>

<main>
	<header
		class="border-black-100 mb-6 flex items-center justify-between border-b-[1px] px-10 py-5"
	>
		<h4 class="text-primary text-xl font-semibold">Control Panel</h4>
		{#if pageUrl === '/'}
			<div class="flex items-center gap-4">
				<ButtonAction size="sm" variant="soft">
					Refresh
					<span class="ms-2">
						<HugeiconsIcon
							icon={RefreshFreeIcons}
							color="var(--color-primary)"
							size="20px"
						/>
					</span>
				</ButtonAction>
				<ButtonAction
					size="sm"
					class="whitespace-nowrap"
					variant="solid"
					callback={async () => {
						// Get selected items from the current page
						const evaultsData = sessionStorage.getItem('selectedEVaults');
						const platformsData = sessionStorage.getItem('selectedPlatforms');

						// If no items selected, show alert
						if (
							(!evaultsData || JSON.parse(evaultsData).length === 0) &&
							(!platformsData || JSON.parse(platformsData).length === 0)
						) {
							alert(
								'Please select eVaults and/or platforms first before starting monitoring.'
							);
							return;
						}

						// Fetch full objects and store them for monitoring page
						try {
							// Fetch evaults if we have IDs
							if (evaultsData) {
								const evaultIds = JSON.parse(evaultsData);
								if (Array.isArray(evaultIds) && evaultIds.length > 0 && typeof evaultIds[0] === 'string') {
									const { EVaultService } = await import('$lib/services/evaultService');
									const allEVaults = await EVaultService.getEVaults();
									const evaultObjects = evaultIds
										.map((id: string) => allEVaults.find((e: any) => (e.evault || e.ename || e.id) === id))
										.filter(Boolean);
									sessionStorage.setItem('selectedEVaultsData', JSON.stringify(evaultObjects));
								}
							}

							// Fetch platforms if we have URLs
							if (platformsData) {
								const platformUrls = JSON.parse(platformsData);
								if (Array.isArray(platformUrls) && platformUrls.length > 0 && typeof platformUrls[0] === 'string') {
									const { registryService } = await import('$lib/services/registry');
									const allPlatforms = await registryService.getPlatforms();
									const platformObjects = platformUrls
										.map((url: string) => allPlatforms.find((p: any) => p.url === url))
										.filter(Boolean);
									sessionStorage.setItem('selectedPlatformsData', JSON.stringify(platformObjects));
								}
							}
						} catch (error) {
							console.error('Error fetching data for monitoring:', error);
						}

						// Navigate to monitoring
						goto('/monitoring');
					}}>Start Monitoring</ButtonAction
				>
			</div>
		{:else}
			<ButtonAction
				size="sm"
				class="whitespace-nowrap"
				variant="solid"
				callback={() => goto('/')}>Exit Monitoring</ButtonAction
			>
		{/if}
	</header>
	<section class="px-10">
		{@render children()}
	</section>
</main>
