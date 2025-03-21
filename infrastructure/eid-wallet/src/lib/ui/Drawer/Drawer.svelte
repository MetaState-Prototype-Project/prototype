<script lang="ts">
	import { CupertinoPane } from 'cupertino-pane';
	import { onMount, type Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { twMerge } from 'tailwind-merge';
	import { pan, swipe } from 'svelte-gestures';
	import { runtime } from '$lib/global/runtime.svelte';
	import { clickOutside } from '$lib/utilities';

	interface IDrawerProps extends HTMLAttributes<HTMLDivElement> {
		isPaneOpen?: boolean;
		children?: Snippet;
		handleSwipe?: (isOpen: boolean | undefined) => void;
	}

	let theme = $state(runtime.computedTheme);
	let drawerElem: HTMLDivElement;
	let backdrop: HTMLDivElement;
	let {
		isPaneOpen = $bindable(),
		children = undefined,
		handleSwipe,
		...restProps
	}: IDrawerProps = $props();

	/**
	 * @type {CupertinoPane}
	 */
	let pane: CupertinoPane;

	const handleClickOutside = () => {
		pane.destroy({ animate: true });
		isPaneOpen = false;
	};

	$effect(() => {
		pane = new CupertinoPane('.cupertino-pane', {
			parentElement: 'body',
			breaks: {
				top: { enabled: true, height: window.innerHeight },
				middle: { enabled: true, height: window.innerHeight * 0.4 },
				bottom: { enabled: true, height: 0 }
			},
			initialBreak: 'middle',
			buttonDestroy: false
		});
		return () => pane.destroy();
	});

	$effect(() => {
		if (isPaneOpen) {
			pane.present({ animate: true }); // Open the pane
		} else {
			pane.destroy({ animate: true }); // Close the pane with animation
		}
		const paneHeader = document.getElementsByClassName('draggable');
		const paneWrapper = document.getElementsByClassName('pane');
		if (paneHeader.length > 0 || paneWrapper.length > 0) {
			if (theme === 'dark') {
				paneWrapper[0].classList.add('dark-mode-drawer');
				paneHeader[0].classList.add('dark-mode-drawer');
			} else {
				paneWrapper[0].classList.remove('dark-mode-drawer');
				paneHeader[0].classList.remove('dark-mode-drawer');
			}
		}
		drawerElem.addEventListener('click_outside', () => {
			handleClickOutside();
		});
	});

	const cBase = twMerge(`py-[40px] dark:bg-darker-background ${restProps.class}`);
</script>

<div
	bind:this={backdrop}
	class={`${isPaneOpen ? 'block' : 'hidden'} fixed inset-0 backdrop-blur-lg pointer-events-none`}
></div>
<div
	{...restProps}
	use:swipe={() => ({
		timeframe: 300, // Optional: Time limit for swipe
		minSwipeDistance: 60 // Optional: Minimum distance for swipe to trigger
	})}
	onswipe={() => {
		handleSwipe?.(isPaneOpen);
	}}
	class="cupertino-pane {cBase}"
	bind:this={drawerElem}
	use:clickOutside
>
	{@render children?.()}
</div>

<style>
	:global(.dark-mode-drawer) {
		background: #0b0d13 !important;
		border-top-left-radius: 20px !important;
		border-top-right-radius: 20px !important;
	}
	:global(.move) {
		margin-top: 5px !important;
	}
</style>
