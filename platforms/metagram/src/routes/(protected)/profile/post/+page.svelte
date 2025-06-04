<script lang="ts">
	import { Post } from '$lib/fragments';
	import { selectedPost } from '$lib/store/store.svelte';

	let post = $state(selectedPost.value);
</script>

<section>
	{#if post}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<Post
			avatar={post.avatar}
			username={post.username}
			userId={post.userId}
			imgUris={post.imgUris}
			caption={post.caption}
			time={post.time}
			count={post.count}
			callback={{
				like: () => alert('like'),
				comment: () => {
					if (window.matchMedia('(max-width: 768px)').matches) {
						alert('Show comment drawer');
					} else {
						alert('Show comment modal');
					}
				},
				menu: () => alert('menu')
			}}
		/>
	{/if}
</section>
