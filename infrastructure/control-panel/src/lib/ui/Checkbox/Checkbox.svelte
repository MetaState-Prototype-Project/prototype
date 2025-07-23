<script lang="ts">
	import { cn } from '$lib/utils';

	interface ICheckboxProps {
		id?: string;
		checked?: boolean;
		onchange?: (e: boolean | Event) => void;
	}

	let {
		id = '',
		checked = $bindable(false),
		onchange = (e: boolean | Event) => {},
		...restProps
	}: ICheckboxProps & { class?: string; disabled?: boolean } = $props();

	let inputElement: HTMLInputElement;

	const cBase = $derived(`
		h-4 w-4 rounded-[3px] border-2 transition-all flex items-center justify-center
		${restProps.disabled ? 'border-black-100' : checked ? 'border-primary' : 'border-black-100'}
		dark:bg-transparent
	`);
</script>

<input
	bind:this={inputElement}
	type="checkbox"
	{id}
	bind:checked
	class="sr-only"
	disabled={restProps.disabled}
	onchange={(e) => {
		const target = e.target as HTMLInputElement;
		checked = target.checked;
		onchange(checked);
	}}
/>

<span
	{...restProps}
	class={cn([cBase, restProps.class].join(' '))}
	tabindex="0"
	role="checkbox"
	aria-checked={checked}
	onclick={() => inputElement?.click()}
>
	{#if checked}
		<span class="bg-primary block h-2 w-2 rounded-[1px]"></span>
	{/if}
</span>
