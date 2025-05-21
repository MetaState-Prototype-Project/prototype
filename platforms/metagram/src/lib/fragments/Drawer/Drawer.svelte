<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { CupertinoPane } from 'cupertino-pane';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';
	import { swipe } from 'svelte-gestures';
	import type { SwipeCustomEvent } from 'svelte-gestures';

	interface IDrawerProps extends HTMLAttributes<HTMLDivElement> {
		isPaneOpen?: boolean;
		children?: Snippet;
		handleSwipe?: (isOpen: boolean | undefined) => void;
	}

	let {
		isPaneOpen = $bindable(),
		children = undefined,
		handleSwipe,
		...restProps
	}: IDrawerProps = $props();

	let drawerElement: HTMLElement;
	let drawer: CupertinoPane;

	function dismiss() {
		if (drawer) drawer.destroy({ animate: true });
	}

	const handleDrawerSwipe = (event: SwipeCustomEvent) => {
		if (event.detail.direction === ('down' as string)) {
			handleSwipe?.(false);
			drawer?.destroy({ animate: true });
			isPaneOpen = false;
		}
	};

	onMount(() => {
		if (!drawerElement) return;
		drawer = new CupertinoPane(drawerElement, {
			showDraggable: false,
			backdrop: true,
			backdropBlur: true,
			backdropOpacity: 0.4,
			animationType: 'ease',
			animationDuration: 300,
			bottomClose: true,
			buttonDestroy: false,
			cssClass: '',
			initialBreak: 'middle',
			events: {
					onBackdropTap: () => dismiss()
				}
		});
		if (isPaneOpen) {
			drawer.present({ animate: true });
		} else {
			drawer.destroy({ animate: true });
		}

		drawer.present();
	});
</script>

<div
	bind:this={drawerElement}
	{...restProps}
	use:swipe={() => ({
		timeframe: 300,
		minSwipeDistance: 60
	})}
	onswipe={handleDrawerSwipe}
	class={cn(restProps.class)}
>
	{@render children?.()}
</div>

<style>
	:global(.pane) {
		border-top-left-radius: 32px !important;
		border-top-right-radius: 32px !important;
		padding: 20px !important;
		scrollbar-width: none !important;
		-ms-overflow-style: none !important;
		::-webkit-scrollbar {
			display: none !important;
		}
	}
</style>
