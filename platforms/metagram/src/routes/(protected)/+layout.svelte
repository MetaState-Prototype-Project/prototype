<script lang="ts">
	import { BottomNav } from '$lib/fragments';
	let { children } = $props();
</script>

<main class="block h-[100dvh] grid-cols-[20%_auto_20%] md:grid">
	<div class="hidden bg-red-300 md:block">Sidebar</div>
	{@render children()}
	<div class="hidden bg-blue-200 md:block">Right Aside</div>
	<BottomNav profileSrc="https://picsum.photos/200" />
</main>
