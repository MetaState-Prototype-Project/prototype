<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	const handleBackdropClick = (event: MouseEvent) => {
		if (event.target === event.currentTarget) {
			dispatch('close');
		}
	};

	const handleKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Escape') {
			dispatch('close');
		}
	};
</script>

<svelte:window on:keydown={handleKeydown} />

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
	on:click={handleBackdropClick}
>
	<div class="relative">
		<slot />
	</div>
</div>
