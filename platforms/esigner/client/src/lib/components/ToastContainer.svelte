<script lang="ts">
	import { toasts, removeToast } from '$lib/stores/toast';
	import type { Toast } from '$lib/stores/toast';

	function getToastStyles(type: Toast['type']) {
		switch (type) {
			case 'success':
				return 'bg-green-50 border-green-200 text-green-800';
			case 'error':
				return 'bg-red-50 border-red-200 text-red-800';
			case 'warning':
				return 'bg-yellow-50 border-yellow-200 text-yellow-800';
			case 'info':
			default:
				return 'bg-blue-50 border-blue-200 text-blue-800';
		}
	}

	function getIcon(type: Toast['type']) {
		switch (type) {
			case 'success':
				return '✓';
			case 'error':
				return '✕';
			case 'warning':
				return '⚠';
			case 'info':
			default:
				return 'ℹ';
		}
	}
</script>

<div class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
	{#each $toasts as toast}
		<div
			class="flex items-start gap-3 p-4 rounded-lg border shadow-lg {getToastStyles(toast.type)} animate-in fade-in slide-in-from-top-2"
			role="alert"
		>
			<div class="flex-shrink-0 w-5 h-5 flex items-center justify-center font-bold">
				{getIcon(toast.type)}
			</div>
			<div class="flex-1 min-w-0">
				<p class="text-sm font-medium">{toast.message}</p>
			</div>
			<button
				onclick={() => removeToast(toast.id)}
				class="flex-shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity"
				aria-label="Close"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	{/each}
</div>

<style>
	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slide-in-from-top-2 {
		from {
			transform: translateY(-0.5rem);
		}
		to {
			transform: translateY(0);
		}
	}

	.animate-in {
		animation: fade-in 0.2s ease-out, slide-in-from-top-2 0.2s ease-out;
	}
</style>


