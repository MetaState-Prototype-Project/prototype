<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<article class="bg-gray rounded-[26px] px-4 py-7">
	{@render children?.()}
</article>
