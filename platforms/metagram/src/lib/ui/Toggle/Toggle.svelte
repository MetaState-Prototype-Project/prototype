<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	interface IToggleProps extends HTMLAttributes<HTMLElement> {
		checked: boolean;
	}

	let { checked = $bindable(false), ...restProps }: IToggleProps = $props();

	let uniqueId = Math.random().toString().split('.')[1];
</script>

<label {...restProps} for={uniqueId} class="relative">
	<div class="h-6 w-11 rounded-full bg-gray-200 transition duration-300">
		<div
			class={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full ${checked ? 'bg-brand-burnt-orange translate-x-5' : 'translate-x-0 bg-white'} transition duration-300`}
		></div>
	</div>
</label>

<input id={uniqueId} type="checkbox" bind:checked class="hidden" tabindex="0" />
