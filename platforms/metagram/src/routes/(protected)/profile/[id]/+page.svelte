<script lang="ts">
	import { page } from '$app/state';
	import { Post, Profile } from '$lib/fragments';
	import { ownerId } from '$lib/store/store.svelte';
	import type { userProfile, PostData } from '$lib/types';
	import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	let selectedPost: PostData | null = $state(null);
	let profileId = $state("");

	const profile: userProfile = {
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
	};

	function handlePostClick(post: PostData) {
		selectedPost = post
	}
</script>

{#if selectedPost}
	<div class="px-5 pt-12">
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
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="flex justify-end items-center" onclick={() => selectedPost = null}>
			<HugeiconsIcon icon={ArrowLeft01Icon} size={24} color="var(--color-black-400)" />
			<p class="text-black-400 font-semibold">Back</p>
		</div>
	</div>
{:else}
	<Profile variant={ownerId.value === profileId ? "user" : "other"} profileData={profile}  handleSinglePost={(post) => handlePostClick(post)} handleFollow={async() => alert("followed")}/>
{/if}
