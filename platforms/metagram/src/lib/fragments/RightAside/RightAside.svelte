<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface IRightAsideProps extends HTMLAttributes<HTMLElement> {
		header: string;
		asideContent: Snippet;
	}
	let { header, asideContent, ...restProps }: IRightAsideProps = $props();
</script>

<aside {...restProps} class="hidden w-full md:block">
	<div class="mx-5">
		<h2 class="mb-8 text-lg font-semibold">{header}</h2>
		<div>
			{@render asideContent?.()}
		</div>
	</div>
</aside>
