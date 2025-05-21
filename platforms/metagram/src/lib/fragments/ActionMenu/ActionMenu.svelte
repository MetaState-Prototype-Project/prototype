<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	interface IContexMenuProps extends HTMLAttributes<HTMLElement> {
		options: Array<{ name: string; handler: () => void }>;
	}

	let { options = [], ...restProps }: IContexMenuProps = $props();

	const cBase = 'w-[max-content] py-2 px-5 rounded-2xl bg-white';
</script>

<ul {...restProps} class={cn([cBase, restProps.class].join(' '))}>
	{#each options as option}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<li class="py-3" onclick={option.handler}>
			<p class="text-black-800">{option.name}</p>
		</li>
	{/each}
</ul>
