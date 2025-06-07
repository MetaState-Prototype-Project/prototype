<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	interface IInputRadioProps extends HTMLAttributes<HTMLElement> {
		selected?: string;
		name?: string;
		value: string;
	}

	let {
		value = '',
		selected = $bindable(''),
		name = '',
		...restProps
	}: IInputRadioProps = $props();

	let radioElement: HTMLInputElement | null = $state(null);

	const cbase =
		"before:h-4.5 before:w-4.5 before:border-brand-burnt-orange before:-left-0.75 before:-bottom-0.25 relative before:absolute before:rounded-full before:border-2 before:bg-white before:content-['']";
</script>

<input
	{...restProps}
	type="radio"
	{value}
	bind:group={selected}
	bind:this={radioElement}
    id={value}
	{name}
	checked={selected === value}
	class={cn(['hidden', restProps.class].join(' '))}
/>

<span
	{...restProps}
	class={cn([cbase, restProps.class].join(' '))}
	role="radio"
	tabindex="0"
	aria-checked={selected === value}
	onclick={() => radioElement?.click()}
	onkeydown={(e) => {
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			radioElement?.click();
		}
	}}
>
	{#if selected === value}
		<span class="bg-brand-burnt-orange bottom-0.75 left-0.25 absolute h-2.5 w-2.5 rounded-full"
		></span>
	{/if}
</span>
