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
					callback={() => goto('/monitoring')}>Start Monitoring</ButtonAction
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
