<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { CupertinoPane } from 'cupertino-pane';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	interface IDrawerProps extends HTMLAttributes<HTMLDivElement> {
		modalEl?: HTMLDivElement;
		paneModal?: CupertinoPane;
		initialBreak?: 'bottom' | 'top' | 'middle';
		handleDismiss?: () => void;
		children?: Snippet;
	}

	let {
		modalEl = $bindable(),
		paneModal = $bindable(),
		children = undefined,
		initialBreak,
		handleDismiss,
		...restProps
	}: IDrawerProps = $props();

	function dismiss() {
		handleDismiss && handleDismiss();
		if (paneModal) paneModal.destroy({ animate: true });
	}

	onMount(() => {
		if (modalEl)
			paneModal = new CupertinoPane(modalEl, {
				modal: true,
				backdrop: true,
				backdropBlur: true,
				backdropOpacity: 0.4,
				animationType: 'ease',
				animationDuration: 300,
				fitHeight: true,
				bottomClose: false,
				showDraggable: false,
				buttonDestroy: false,
				initialBreak: initialBreak,
				breaks: {
					top: { enabled: true, height: 600 },
					middle: { enabled: true, height: 400 },
					bottom: { enabled: true, height: 200 }
				},
				cssClass: 'modal',
				events: {
					onBackdropTap: () => dismiss()
				}
			});
	});
</script>

<div bind:this={modalEl} {...restProps} class={cn(restProps.class)}>
	{#if children}
		{@render children?.()}
	{/if}
</div>

<style>
	:global(.modal .pane) {
		width: 100% !important;
		max-height: 600px !important;
		min-height: 100px !important;
		height: auto !important;
		position: fixed !important;
		bottom: 30px !important;
		left: 40% !important;
		transform: translateX(-50%) !important;
		border-radius: 32px !important;
		padding: 20px !important;
		background-color: var(--color-white) !important;
		overflow: scroll !important;
		scrollbar-width: none !important;
		-ms-overflow-style: none !important;
		::-webkit-scrollbar {
			display: none !important;
		}
	}
</style>
