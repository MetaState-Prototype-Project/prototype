<script lang="ts">
	import type { Snippet } from 'svelte';

	interface IModalProps {
		open: boolean;
		onclose?: () => void;
		allowClickOutside?: boolean;
		children?: Snippet;
	}

	const { open, onclose, allowClickOutside, children }: IModalProps = $props();

	let modal: HTMLDialogElement | null = $state(null);

	const dialogClickHandler = (event: MouseEvent) => {
		if (!modal) return;
		let rect = modal.getBoundingClientRect();
		let isInDialog =
			rect.top <= event.clientY &&
			event.clientY <= rect.top + rect.height &&
			rect.left <= event.clientX &&
			event.clientX <= rect.left + rect.width;
		if (!isInDialog && allowClickOutside) {
			modal.close();
			onclose?.();
		} else if (!isInDialog) {
			event.stopPropagation();
			// make the modal pulse to indicate it is still open
			modal.animate(
				[
					{ transform: 'scale(1)' },
					{ transform: 'scale(1.025)' },
					{ transform: 'scale(1)' },
					{ transform: 'scale(1.0125)' },
					{ transform: 'scale(1)' }
				],
				{
					duration: 250,
					easing: 'ease-in-out'
				}
			);
			onclose?.();
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
