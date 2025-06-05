<script lang="ts">
	import { Post } from '$lib/fragments';
	import { selectedPost } from '$lib/store/store.svelte';

	let post = $state(selectedPost.value);
</script>

