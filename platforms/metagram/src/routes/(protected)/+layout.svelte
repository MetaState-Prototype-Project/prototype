<script lang="ts">
	import { BottomNav } from '$lib/fragments';
	let { children } = $props();
</script>

<main>
	{@render children()}
	<BottomNav profileSrc="https://picsum.photos/200" />
</main>
