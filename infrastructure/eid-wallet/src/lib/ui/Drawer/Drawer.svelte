<script lang="ts">
	import { CupertinoPane } from 'cupertino-pane';
	import {type Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { swipe } from 'svelte-gestures';
	import { clickOutside, cn } from '$lib/utils';

	interface IDrawerProps extends HTMLAttributes<HTMLDivElement> {
		isPaneOpen?: boolean;
		children?: Snippet;
		handleSwipe?: (isOpen: boolean | undefined) => void;
	}

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
		drawerElem.addEventListener('click_outside', () => {
			handleClickOutside();
		});
	});

	const cBase = cn("py-[40px] bg-white-900", restProps.class);
</script>

<div
	bind:this={backdrop}
	class={cn(isPaneOpen ? "block" : "hidden", "fixed inset-0 backdrop-blur-lg pointer-events-none")}
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
	class={cBase}
	bind:this={drawerElem}
	use:clickOutside
>
	{@render children?.()}
</div>

<style>
	:global(.move) {
		margin-top: 5px !important;
	}
</style>