<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { CupertinoPane } from 'cupertino-pane';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	interface IDrawerProps extends HTMLAttributes<HTMLDivElement> {
		modalEl?: HTMLDivElement;
		paneModal?: CupertinoPane;
		children?: Snippet;
	}

	let {
		modalEl = $bindable(),
		paneModal = $bindable(),
		children = undefined,
		...restProps
	}: IDrawerProps = $props();

	function present() {
		if (paneModal) paneModal.present({ animate: true });
	}

	function dismiss() {
		if (paneModal) paneModal.destroy({ animate: true });
	}

	onMount(() => {
		if (modalEl)
			paneModal = new CupertinoPane(modalEl, {
				modal: true,
				backdrop: true,
				backdropOpacity: 0.4,
				fitHeight: true,
				showDraggable: true,
				buttonDestroy: false,
				breaks: {
					bottom: { enabled: true, height: 250 }
				},
				initialBreak: 'bottom',
				cssClass: 'modal',
				events: {
					onBackdropTap: () => dismiss()
				}
			});

		present();

		return () => {
			if (paneModal) paneModal.destroy({ animate: false });
		};
	});
</script>

<div bind:this={modalEl} {...restProps} class={cn(restProps.class)}>
	{#if children}
		{@render children?.()}
	{/if}
</div>

<style>
	:global(.modal .pane) {
		width: 95% !important;
		max-height: 300px !important;
		min-height: 100px !important;
		height: auto !important;
		position: fixed !important;
		bottom: 30px !important;
		left: 50% !important;
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
