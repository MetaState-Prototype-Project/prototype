<script lang="ts">
	import BottomNav from '$lib/fragments/BottomNav/BottomNav.svelte';
	import '../app.css';

	let { children } = $props();

	let activeTab = $state('home');
</script>

<main>
	{@render children()}
	<BottomNav {activeTab} profileSrc="https://picsum.photos/200" />
</main>
