<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Profile } from '$lib/fragments';
	import { ownerId, selectedPost } from '$lib/store/store.svelte';
	import type { userProfile, PostData } from '$lib/types';

	let profileId = $derived(page.params.id);

	const profile: userProfile = $state({
		userId: page.params.id,
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
				userId: 'asdf',
				username: '_.ananyayaya._',
				imgUris: [
					'https://picsum.photos/800',
					'https://picsum.photos/600',
					'https://picsum.photos/800',
					'https://picsum.photos/600'
				],
				caption: 'Loved this one!',
				time: '2h ago',
				count: { likes: 200, comments: 45 }
			},
			{
				id: '2',
				avatar: 'https://picsum.photos/200/300',
				userId: 'asdf',
				username: '_.ananyayaya._',
				imgUris: ['https://picsum.photos/id/1012/200/200'],
				caption: 'Loved this one!',
				time: '2h ago',
				count: { likes: 200, comments: 45 }
			},
			{
				id: '3',
				avatar: 'https://picsum.photos/200/300',
				userId: 'asdf',
				username: '_.ananyayaya._',
				imgUris: ['https://picsum.photos/id/1013/200/200'],
				caption: 'Loved this one!',
				time: '2h ago',
				count: { likes: 200, comments: 45 }
			}
		]
	});

	function handlePostClick(post: PostData) {
		selectedPost.value = post;
		goto('/profile/post');
	}
</script>

<section class="pb-8">
	<Profile
		variant={ownerId.value === profileId ? 'user' : 'other'}
		profileData={profile}
		handleSinglePost={(post) => handlePostClick(post)}
		handleFollow={async () => alert('followed')}
		handleMessage={async () => goto('/messages')}
	/>
</section>
