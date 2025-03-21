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
			parentElement: 'body',
			breaks: {
				top: { enabled: true, height: window.innerHeight },
				middle: { enabled: true, height: window.innerHeight * 0.3 },
				bottom: { enabled: true, height: 0 }
			},
			initialBreak: 'middle',
			buttonDestroy: false
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

	const cBase = cn(
		"fixed bottom-0 left-0 w-full bg-white-900 shadow-[32px] rounded-3xl py-[2.3vh] px-[6vw]",
		restProps.class
	);
</script>

<div
	bind:this={backdrop}
	class={cn(
		isPaneOpen ? "block" : "hidden",
		"fixed inset-0 backdrop-blur-lg pointer-events-none"
	)}
></div>

<div
	{...restProps}
	use:swipe={() => ({
		timeframe: 300, 
		minSwipeDistance: 60
	})}
	onswipe={() => handleSwipe?.(isPaneOpen)}
	class={cBase}
	bind:this={drawerElem}
	use:clickOutside
>

	<div class="flex justify-center mb-[6px]">
		<div class="w-[62px] h-[6px] bg-drawer-indicator rounded-full"></div>
	</div>

	<div class="px-6">
		{@render children?.()}
	</div>
</div>


