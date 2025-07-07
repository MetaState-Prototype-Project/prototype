<script lang="ts">
	import { Button } from '$lib/ui';
	import type { userProfile, PostData } from '$lib/types';
	import Post from '../Post/Post.svelte';
	import { posts } from '$lib/stores/posts';

	let imgPosts = $derived(profileData.posts.filter((e) => e.imgUris && e.imgUris.length > 0));

	let {
		variant = 'user',
		profileData,
		handleSinglePost,
		handleFollow,
		handleMessage
	}: {
		variant: 'user' | 'other';
		profileData: userProfile;
		handleSinglePost: (post: PostData) => void;
		handleFollow: () => Promise<void>;
		handleMessage: () => Promise<void>;
	} = $props();
</script>

<div class="flex flex-col gap-4 p-4">
	<div class="flex items-center gap-4">
		<img
			src={profileData.avatarUrl ?? '/images/user.png'}
			onerror={(profileData.avatarUrl = '/images/user.png')}
			alt={profileData.username}
			class="h-20 w-20 rounded-full object-cover"
		/>
		<div class="flex-1">
			<h2 class="text-xl font-semibold">{profileData?.name ?? profileData?.handle}</h2>
			<p class="text-gray-600">{profileData?.description}</p>
		</div>
		{#if variant === 'other'}
			<div class="flex gap-2">
				<Button variant="primary" size="sm" callback={handleFollow}>Follow</Button>
				<Button variant="primary" size="sm" callback={handleMessage}>Message</Button>
			</div>
		{/if}
	</div>

	<div class="flex gap-8 text-center">
		<div>
			<p class="font-semibold">{profileData.totalPosts}</p>
			<p class="text-gray-600">Posts</p>
		</div>
		<div>
			<p class="font-semibold">{0}</p>
			<p class="text-gray-600">Followers</p>
		</div>
		<div>
			<p class="font-semibold">{0}</p>
			<p class="text-gray-600">Following</p>
		</div>
	</div>

	<div class="grid grid-cols-3 gap-1">
		{#if imgPosts.length > 0}
			{#each imgPosts as post}
				<li class="mb-6 list-none">
					<Post
						avatar={profileData.avatarUrl || 'https://picsum.photos/200/200'}
						username={profileData?.name ?? profileData?.username}
						imgUris={post.imgUris ?? []}
						text={post.caption}
						time={post.time ? new Date(post.time).toLocaleDateString() : ''}
						callback={{
							like: async () => {
								try {
								} catch (err) {}
							},
							comment: () => {
								if (window.matchMedia('(max-width: 768px)').matches) {
								} else {
								}
							},
							menu: () => alert('menu')
						}}
					/>
				</li>
			{/each}
		{:else}
			<div class="w-max py-10">
				{#if profileData.posts.length > 0}
					This user has some text only posts, pictique can't display them here
				{:else}
					This user hasn't posted yet
				{/if}
			</div>
		{/if}
	</div>
</div>
