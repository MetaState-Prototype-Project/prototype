<script lang="ts">
	import { clickOutside, cn } from '$lib/utils';
	import { MoreVerticalIcon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { tick } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface IContextMenuProps extends HTMLAttributes<HTMLElement> {
		options: Array<{ name: string; handler: () => void }>;
	}

	let { options = [], ...restProps }: IContextMenuProps = $props();
	let showActionMenu = $state(false);
	let menuEl: HTMLUListElement | null = $state(null);
	let buttonEl: HTMLElement | null = null;

	function openMenu() {
		showActionMenu = true;

		tick().then(() => {
			if (menuEl && buttonEl) {
				const { innerWidth, innerHeight } = window;
				const menuRect = menuEl.getBoundingClientRect();
				const buttonRect = buttonEl.getBoundingClientRect();

				// Position vertically aligned to button top (viewport)
				let top = buttonRect.top;
				let left = buttonRect.right;

				// If it overflows right, position to the left of the button
				if (innerWidth - buttonRect.right < menuRect.width) {
					left = buttonRect.left - menuRect.width;
				}

				// If it overflows bottom, adjust upward
				if (innerHeight - buttonRect.top < menuRect.height) {
					top = innerHeight - menuRect.height - 10;
				}

				menuEl.style.left = `${left}px`;
				menuEl.style.top = `${top}px`;
			}
		});
	}

	function closeMenu() {
		showActionMenu = false;
	}

	const cBase = 'fixed z-50 w-[max-content] py-2 px-5 rounded-2xl bg-white shadow-lg';
</script>

<div class="relative inline-block">
	<button
		bind:this={buttonEl}
		onclick={(e) => {
			e.preventDefault(), openMenu();
		}}
	>
		<HugeiconsIcon icon={MoreVerticalIcon} size={24} color="black" />
	</button>
</div>

{#if showActionMenu}
	<ul
		{...restProps}
		use:clickOutside={() => closeMenu()}
		bind:this={menuEl}
		class={cn([cBase, restProps.class].join(' '))}
	>
		{#each options as option, i (i)}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<li
				class="cursor-pointer py-3"
				onclick={() => {
					option.handler();
					closeMenu();
				}}
			>
				<p class="text-black-800">{option.name}</p>
			</li>
		{/each}
	</ul>
{/if}
