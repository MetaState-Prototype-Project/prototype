<script lang="ts">
	import { Post } from '$lib/fragments';
	import type { PostData, userProfile } from '$lib/types';

	let selectedPost: PostData | null = null;
</script>

{#if selectedPost}
	<Post
		avatar={selectedPost.avatar}
		username={selectedPost.username}
		userId={selectedPost.userId}
		imgUris={selectedPost.imgUris}
		caption={selectedPost.caption}
		time={selectedPost.time}
		count={selectedPost.count}
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
