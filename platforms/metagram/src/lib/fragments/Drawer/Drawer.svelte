<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { CupertinoPane } from 'cupertino-pane';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';
	import { swipe } from 'svelte-gestures';
	import type { SwipeCustomEvent } from 'svelte-gestures';

	interface IDrawerProps extends HTMLAttributes<HTMLDivElement> {
		drawer?: CupertinoPane;
		children?: Snippet;
	}

	let { drawer = $bindable(), children = undefined, ...restProps }: IDrawerProps = $props();

	let drawerElement: HTMLElement;

	function dismiss() {
		if (drawer) drawer.destroy({ animate: true });
	}

	const handleDrawerSwipe = (event: SwipeCustomEvent) => {
		if (event.detail.direction === ('down' as string)) {
			drawer?.destroy({ animate: true });
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
	<div class="h-[100%] overflow-y-scroll">
		{@render children?.()}
	</div>
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
