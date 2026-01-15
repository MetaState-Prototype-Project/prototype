<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import Header from '../Header/Header.svelte';
	import type { Snippet } from 'svelte';

	interface IMainPanelProps extends HTMLAttributes<HTMLDivElement> {
		children: Snippet;
		RightPanel?: Snippet;
	}

	let { children, RightPanel }: IMainPanelProps = $props();
</script>

<div class="flex flex-col md:h-dvh md:flex-row">
	<section
		class="hide-scrollbar min-w-0 flex-1 overflow-y-auto px-4 pb-8 md:h-dvh md:px-8 md:pt-8"
	>
		<div class="flex flex-col">
			<Header />
			{@render children()}
		</div>
	</section>
	{#if RightPanel}
		<aside
			class="hide-scrollbar relative hidden h-dvh w-[30vw] overflow-y-scroll border border-y-0 border-e-0 border-s-gray-200 px-8 pt-12 md:flex md:flex-col"
		>
			{@render RightPanel?.()}
		</aside>
	{/if}
</div>
