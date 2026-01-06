<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { CupertinoPane } from 'cupertino-pane';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';
	import { useSwipe } from 'svelte-gestures';
	import type { SwipeCustomEvent } from 'svelte-gestures';

	interface IDrawerProps extends HTMLAttributes<HTMLDivElement> {
		drawer?: CupertinoPane;
		children?: Snippet;
		onClose?: () => void;
	}

	let {
		drawer = $bindable(),
		children = undefined,
		onClose,
		...restProps
	}: IDrawerProps = $props();

	let drawerElement: HTMLElement;

	function dismiss() {
		if (drawer) drawer.destroy({ animate: true });
		onClose?.();
	}

	function downSwipeHandler() {
		drawer?.destroy({ animate: true });
		onClose?.();
	}

	const swipeActions = useSwipe(
		() => {},
		() => ({
			timeframe: 300,
			minSwipeDistance: 60
		}),
		{
			onswipedown: downSwipeHandler
		}
	);

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
			initialBreak: 'top',
			breaks: {
				top: { enabled: true, height: window.innerHeight * 0.9 },
				middle: { enabled: true, height: window.innerHeight * 0.5 }
			},
			events: {
				onBackdropTap: () => dismiss(),
				onWillDismiss: () => onClose?.()
			}
		});
	});
</script>

<div bind:this={drawerElement} {...restProps} {...swipeActions} class={cn(restProps.class)}>
	{@render children?.()}
</div>

<style>
	:global(.pane) {
		border-top-left-radius: 32px !important;
		border-top-right-radius: 32px !important;
		padding: 20px !important;
		overflow-y: scroll !important;
		scrollbar-width: none !important;
		-ms-overflow-style: none !important;
	}
	:global(.pane)::-webkit-scrollbar {
		display: none !important;
	}
</style>
