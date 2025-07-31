<script lang="ts">
	import type { PostData, userProfile } from '$lib/types';
	import { Button } from '$lib/ui';
	import Post from '../Post/Post.svelte';

	let {
		variant = 'user',
		profileData,
		handleFollow,
		handleSinglePost,
		handleMessage
	}: {
		variant: 'user' | 'other';
		profileData: userProfile;
		handleSinglePost: (post: PostData) => void;
		handleFollow: () => Promise<void>;
		handleMessage: () => Promise<void>;
	} = $props();

	let imgPosts = $derived(profileData.posts.filter((e) => e.imgUris && e.imgUris.length > 0));
</script>

<div class="flex flex-col gap-4 p-4">
	<div class="flex items-center gap-4">
		<img
			src={profileData.avatarUrl ?? '/images/user.png'}
			onerror={() => {
				profileData.avatarUrl = '/images/user.png';
			}}
			alt={profileData.handle}
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
			{#each imgPosts as post (post.id)}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<li class="mb-6 list-none" onclick={() => handleSinglePost(post)}>
					<Post
						avatar={profileData.avatarUrl || 'https://picsum.photos/200/200'}
						handle={profileData?.name ?? profileData?.handle}
						imgUris={post.imgUris ?? []}
						text={post.caption}
						time={post.time ? new Date(post.time).toLocaleDateString() : ''}
						callback={{
							like: () => true,
							comment: () => true,
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
