<script lang="ts">
	import { CupertinoPane } from 'cupertino-pane';
	import { type Snippet } from 'svelte';
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
	let pane: CupertinoPane;

	let {
		isPaneOpen = $bindable(),
		children = undefined,
		handleSwipe,
		...restProps
	}: IDrawerProps = $props();

	const handleClickOutside = () => {
		pane?.destroy({ animate: true });
		isPaneOpen = false;
	};

	$effect(() => {
		if (!drawerElem) return;
		pane = new CupertinoPane(drawerElem, {
			fitHeight:true,
			backdrop: true,
			backdropOpacity: 0.5,
			backdropBlur: true,
			bottomClose: true,
			buttonDestroy: false,
			showDraggable: true,
			upperThanTop: true,
			breaks: {
			bottom: { enabled: true, height: 300 }, 
			},
			initialBreak: 'bottom',
			bottomOffset: -70, 
		});

		if (isPaneOpen) {
			pane.present({ animate: true });
		} else {
			pane.destroy({ animate: true });
		}

		return () => pane.destroy();
	});

	$effect(() => {
		if (isPaneOpen) {
			pane.present({ animate: true });
		} else {
			pane.destroy({ animate: true });
		}
		drawerElem.addEventListener('click_outside', () => {
			handleClickOutside();
		});
	});
</script>

<div
	{...restProps}
	use:swipe={() => ({
		timeframe: 300, 
		minSwipeDistance: 60
	})}
	onswipe={() => handleSwipe?.(isPaneOpen)}
	bind:this={drawerElem}
	use:clickOutside
	class={cn(restProps.class)}
>
	<div class="px-6">
		{@render children?.()}
	</div>
</div>

<style>
	:global(.pane){
		width: 95% !important;
		border-radius: 32px !important;
		padding: 20px !important;
		background-color: var(--color-white-900) !important;
	}

	:global(.move) {
		margin-block: 6px  !important;
	}
</style>


