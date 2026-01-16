<script lang="ts">
	import type { PostData, userProfile } from '$lib/types';
	import { Button } from '$lib/ui';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import Post from '../Post/Post.svelte';
	import { Spring } from 'svelte/motion';
	import { Tick01Icon } from '@hugeicons/core-free-icons';

	let {
		variant = 'user',
		profileData,
		handleFollow,
		handleSinglePost,
		handleMessage,
		isFollowing = $bindable(false)
	}: {
		variant: 'user' | 'other';
		profileData: userProfile;
		handleSinglePost: (post: PostData) => void;
		handleFollow: () => Promise<void>;
		handleMessage: () => Promise<void>;
		isFollowing: boolean;
	} = $props();

	let imgPosts = $derived(profileData.posts.filter((e) => e.imgUris && e.imgUris.length > 0));
	let requestSent = $state(false);

	const btnScale = new Spring(1, { stiffness: 0.2, damping: 0.4 });

	async function wrappedFollow() {
		if (isFollowing || requestSent) return;

		btnScale.target = 0.95;

		try {
			await handleFollow();

			requestSent = true;
			btnScale.target = 1;

			setTimeout(() => {
				requestSent = false;
			}, 2000);
		} catch (e) {
			console.error(e);
			btnScale.target = 1;
		}
	}
</script>

<div class="flex flex-col gap-4 p-4">
	<div class="flex items-center gap-4">
		<img
			src={profileData.avatarUrl ?? '/images/user.png'}
			onerror={() => {
				profileData.avatarUrl = '/images/user.png';
			}}
			alt={profileData.username}
			class="h-20 w-20 rounded-full object-cover"
		/>
		<div class="flex-1">
			<h2 class="text-xl font-semibold">{profileData?.name ?? profileData?.handle}</h2>
			<p class="text-gray-600">{profileData?.description}</p>
		</div>
		{#if variant === 'other'}
			<div class="flex gap-2">
				<div style="transform: scale({btnScale.current}); transition: transform 0.2s ease;">
					<Button
						variant={'primary'}
						size="sm"
						callback={wrappedFollow}
						disabled={isFollowing || requestSent}
						class="min-w-[110px] transition-all duration-500 {requestSent
							? 'opacity-80'
							: ''}"
					>
						<div class="flex items-center justify-center gap-2">
							{#if requestSent}
								<HugeiconsIcon icon={Tick01Icon} size={16} />
								<span>Followed</span>
							{:else if isFollowing}
								<span class="flex gap-0.5">
									<span class="animate-bounce">.</span>
									<span class="animate-bounce [animation-delay:0.2s]">.</span>
									<span class="animate-bounce [animation-delay:0.4s]">.</span>
								</span>
								<span>Following</span>
							{:else}
								Follow
							{/if}
						</div>
					</Button>
				</div>
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
						username={profileData?.name ?? profileData?.username}
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
