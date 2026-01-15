<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface IRightAsideProps extends HTMLAttributes<HTMLElement> {
		header?: Snippet;
	}
	let { header, children, ...restProps }: IRightAsideProps = $props();
</script>

<aside
	{...restProps}
	class="hide-scrollbar relative hidden h-dvh w-[30vw] overflow-y-scroll border border-y-0 border-e-0 border-s-gray-200 pl-8 md:flex md:flex-col"
>
	{#if header}
		<h2 class="mb-10 text-lg font-semibold">
			{@render header?.()}
		</h2>
	{/if}
	<div>
		{@render children?.()}
	</div>
</aside>
