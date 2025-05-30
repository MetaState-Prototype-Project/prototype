<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { Header } from '..';

	interface IRightAsideProps extends HTMLAttributes<HTMLElement> {
		header: Snippet;
		asideContent: Snippet;
	}
	let { header, asideContent, ...restProps }: IRightAsideProps = $props();
</script>

<aside {...restProps} class="hidden border border-y-0 border-s-gray-200 md:block md:pt-13">
	<div class="mx-5">
		<h2 class="mb-10 text-lg font-semibold">
			{@render header?.()}
		</h2>
		<div>
			{@render asideContent?.()}
		</div>
	</div>
</aside>
