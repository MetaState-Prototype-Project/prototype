<script lang="ts">
	import { onMount, onDestroy, type Snippet } from 'svelte';
	import { CupertinoPane } from 'cupertino-pane';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

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

	let modalEl: HTMLDivElement;
	let paneModal: CupertinoPane;

	function present() {
		paneModal.present({ animate: true });
	}

	function dismiss() {
		paneModal.destroy({ animate: true });
	}

	onMount(() => {
		paneModal = new CupertinoPane(modalEl, {
			modal: true,
			backdrop: true,
            backdropOpacity: 0.4,
            fitHeight: true,
			showDraggable: true,
            buttonDestroy: false,
            breaks: {
            bottom: { enabled: true, height: 250 },
            },
            initialBreak: "bottom",
			events: {
				onBackdropTap: () => dismiss()
			}
		});

		present();

		return () => {
			paneModal.destroy({ animate: false });
		};
	});
</script>

<div
	bind:this={modalEl}
	{...restProps}
	class={cn("p-5",restProps.class)}
>
	{#if children}
		{@render children?.()}
	{/if}
</div>

<style>
    :global(.pane) {
        width: 95% !important;
        max-height: 300px !important;
        min-height: 250px !important;
        height: auto !important;
        position: fixed !important;
        bottom: 30px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        border-radius: 32px !important;
        padding-block-start: 20px !important;
        padding-block-end: 20px !important;
        background-color: var(--color-white) !important;
        overflow: scroll !important;
    }
</style>