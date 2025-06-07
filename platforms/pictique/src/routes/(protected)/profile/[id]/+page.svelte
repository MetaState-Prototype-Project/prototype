<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Profile } from '$lib/fragments';
	import { ownerId, selectedPost } from '$lib/store/store.svelte';
	import type { userProfile, PostData } from '$lib/types';
	import { apiClient } from '$lib/utils/axios';
	import { onMount } from 'svelte';
	import Post from '../../../../lib/fragments/Post/Post.svelte';

	let profileId = $derived(page.params.id);
	let profile = $state<userProfile | null>(null);
	let error = $state<string | null>(null);
	let loading = $state(true);

	async function fetchProfile() {
		try {
			loading = true;
			error = null;
			const response = await apiClient.get(`/api/users/${profileId}`);
			profile = response.data;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load profile';
		} finally {
			loading = false;
		}
	}

	async function handleFollow() {
		try {
			await apiClient.post(`/api/users/${profileId}/follow`);
			await fetchProfile(); // Refresh profile to update follower count
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to follow user';
		}
	}

	async function handleMessage() {
		try {
			await apiClient.post(`/api/chats/`, {
				name: profile.username,
				participantIds: [profileId]
			});
			goto('/messages');
			await fetchProfile(); // Refresh profile to update follower count
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to follow user';
		}
	}

	function handlePostClick(post: PostData) {
		selectedPost.value = post;
		goto('/profile/post');
	}

	onMount(fetchProfile);
</script>

<section class="pb-8">
	{#if loading}
		<div class="flex h-64 items-center justify-center">
			<p class="text-gray-500">Loading profile...</p>
		</div>
	{:else if error}
		<div class="flex h-64 items-center justify-center">
			<p class="text-red-500">{error}</p>
		</div>
	{:else if profile}
		<Profile
			variant={ownerId.value === profileId ? 'user' : 'other'}
			profileData={profile}
			handleSinglePost={(post) => handlePostClick(post)}
			{handleFollow}
			{handleMessage}
		/>

		{#if profile}
			<!-- {#each profile.posts as post (post.id)} -->
			<!-- 	<li class="mb-6"> -->
			<!-- 		<Post -->
			<!-- 			avatar={post.author.avatarUrl} -->
			<!-- 			username={post.author.handle} -->
			<!-- 			imgUris={post.images} -->
			<!-- 			text={post.text} -->
			<!-- 			time={new Date(post.createdAt).toLocaleDateString()} -->
			<!-- 			count={{ likes: post.likedBy.length, comments: post.comments.length }} -->
			<!-- 			callback={{ -->
			<!-- 				like: async () => { -->
			<!-- 					try { -->
			<!-- 					} catch (err) {} -->
			<!-- 				}, -->
			<!-- 				comment: () => { -->
			<!-- 					if (window.matchMedia('(max-width: 768px)').matches) { -->
			<!-- 					} else { -->
			<!-- 					} -->
			<!-- 				}, -->
			<!-- 				menu: () => alert('menu') -->
			<!-- 			}} -->
			<!-- 		/> -->
			<!-- 	</li> -->
			<!-- {/each} -->
		{/if}
	{/if}
</section>
