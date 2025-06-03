<script lang="ts">
	import { Post, Profile } from '$lib/fragments';
	import type { userProfile, PostData } from '$lib/types';

	let selectedPost: PostData | null = null;

	const profile: userProfile = {
		userId: '_.ananyayaya._',
		username: 'Ananya Rana',
		avatar: 'https://picsum.photos/200/300',
		totalPosts: 1,
		followers: 300,
		following: 150,
		userBio:
			'Friendly nerd who likes to not meet people as much as possible. Leave the earth for me yall.',
		posts: [
			{
				id: '1',
				avatar: 'https://picsum.photos/200/300',
				username: '_.ananyayaya._',
				imgUri: 'https://picsum.photos/id/1011/200/200',
				caption: 'Loved this one!',
				time: '2h ago',
				count: { likes: 200, comments: 45 }
			},
			{
				id: '2',
				avatar: 'https://picsum.photos/200/300',
				username: '_.ananyayaya._',
				imgUri: 'https://picsum.photos/id/1012/200/200',
				caption: 'Loved this one!',
				time: '2h ago',
				count: { likes: 200, comments: 45 }
			},
			{
				id: '3',
				avatar: 'https://picsum.photos/200/300',
				username: '_.ananyayaya._',
				imgUri: 'https://picsum.photos/id/1013/200/200',
				caption: 'Loved this one!',
				time: '2h ago',
				count: { likes: 200, comments: 45 }
			}
		]
	};

	function handlePostClick(postId: string) {
		const found = profile.posts.find((p) => p.id === postId);
		if (found) {
			selectedPost = found;
		}
	}
</script>

{#if selectedPost}
	<div class="px-5 pt-12">
		<Post
			avatar={selectedPost.avatar}
			username={selectedPost.username}
			imgUri={selectedPost.imgUri}
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
	</div>
{:else}
	<Profile variant="user" profileData={profile} onPostClick={handlePostClick} />
{/if}
