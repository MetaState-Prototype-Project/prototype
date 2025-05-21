<script lang="ts">
	import { clickOutside, cn } from '$lib/utils';
	import { MoreVerticalIcon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { tick } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface IContexMenuProps extends HTMLAttributes<HTMLElement> {
		options: Array<{ name: string; handler: () => void }>;
	}

	let { options = [], ...restProps }: IContexMenuProps = $props();
	let showActionMenu = $state(false);
	let menuEl: HTMLUListElement | null = $state(null);
	let mouseX = 0;
	let mouseY = 0;

	function openMenu(event: MouseEvent) {
		mouseX = event.clientX;
		mouseY = event.clientY;
		showActionMenu = true;

		tick().then(() => {
			if (menuEl) {
				const { innerWidth, innerHeight } = window;
				const rect = menuEl.getBoundingClientRect();

				// Adjust horizontal position
				if (mouseX + rect.width > innerWidth) {
					menuEl.style.left = `${mouseX - rect.width}px`;
				} else {
					menuEl.style.left = `${mouseX}px`;
				}

				// Adjust vertical position
				if (mouseY + rect.height > innerHeight) {
					menuEl.style.top = `${mouseY - rect.height}px`;
				} else {
					menuEl.style.top = `${mouseY}px`;
				}
			}
		});
	}

	function closeMenu() {
		showActionMenu = false;
	}

	const cBase = 'w-[max-content] py-2 px-5 rounded-2xl bg-white';
</script>

<div class={cn([restProps.class].join(' '))}>
	<button onclick={(e) => {e.preventDefault(), openMenu(e)}}>
		<HugeiconsIcon icon={MoreVerticalIcon} size={24} color="black"/>
	</button>
	{#if showActionMenu}
	<ul use:clickOutside={() => closeMenu()} bind:this={menuEl} {...restProps} class={cBase}>
		{#each options as option}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<li class="py-3" onclick={() => { option.handler(); closeMenu(); }}>
			<p class="text-black-800">{option.name}</p>
		</li>
	{/each}
	</ul>
	{/if}
</div>
