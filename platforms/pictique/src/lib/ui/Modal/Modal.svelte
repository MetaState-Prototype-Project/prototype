<script lang="ts">
	import type { Snippet } from 'svelte';

	interface IModalProps {
		open: boolean;
		onclose?: () => void;
		onClickOutside?: (modal: HTMLDialogElement) => void;
		children?: Snippet;
	}

	const { open, onclose, onClickOutside, children }: IModalProps = $props();

	let modal: HTMLDialogElement | null = $state(null);

	const dialogClickHandler = (event: MouseEvent) => {
		if (!modal) return;
		let rect = modal.getBoundingClientRect();
		let isInDialog =
			rect.top <= event.clientY &&
			event.clientY <= rect.top + rect.height &&
			rect.left <= event.clientX &&
			event.clientX <= rect.left + rect.width;
		if (!isInDialog) {
			event.stopPropagation();
			if (onClickOutside) {
				onClickOutside(modal);
			} else {
				// Default behavior: close the modal
				modal.close();
				onclose?.();
			}
		}
	};

	$effect(() => {
		if (open) modal?.showModal();
		else {
			modal?.close();
			onclose?.();
		}
	});
</script>

<dialog
	class="m-auto rounded-xl p-4 outline-none backdrop:bg-black/50"
	bind:this={modal}
	onclick={(e) => dialogClickHandler(e)}
>
	{@render children?.()}
</dialog>
