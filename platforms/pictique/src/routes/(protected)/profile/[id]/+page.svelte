<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { PostModal, Profile } from '$lib/fragments';
	import { selectedPost } from '$lib/store/store.svelte';
	import { createComment } from '$lib/stores/comments';
	import { toggleLike } from '$lib/stores/posts';
	import type { PostData, userProfile } from '$lib/types';
	import { Modal } from '$lib/ui';
	import { apiClient, getAuthId } from '$lib/utils/axios';
	import { onMount } from 'svelte';

	let profileId = $derived(page.params.id);
	let profile = $state<userProfile | null>(null);
	let error = $state<string | null>(null);
	let loading = $state(true);
	let ownerId: string | null = $derived(getAuthId());
	let ownerProfile = $derived.by(async () => {
		if (ownerId) {
			const response = await apiClient.get<userProfile>(`/api/users/${ownerId}`);
			return response.data;
		}
	});

	async function fetchProfile() {
		try {
			loading = true;
			error = null;
			const response = await apiClient.get<userProfile>(`/api/users/${profileId}`);
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
			await apiClient.post('/api/chats/', {
				name: profile?.username,
				participantIds: [profileId]
			});
			goto('/messages');
			await fetchProfile(); // Refresh profile to update follower count
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to follow user';
		}
	}

	function handlePostClick(post: PostData) {
		console.log(post);
		selectedPost.value = post;
		// goto("/profile/post");
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
			variant={ownerId === profileId ? 'user' : 'other'}
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

{#await ownerProfile then ownerProfile}
	<Modal
		open={selectedPost.value !== null}
		onclose={() => {
			selectedPost.value = null;
		}}
	>
		<PostModal
			avatar={profile?.avatarUrl ?? ''}
			userId={profile?.id}
			username={profile?.name ?? profile?.handle ?? ''}
			imgUris={selectedPost.value?.imgUris ?? []}
			text={selectedPost.value?.caption ?? ''}
			count={selectedPost.value?.count ?? { likes: 0, comments: 0 }}
			{ownerProfile}
			callback={{
				like: async () => {
					await toggleLike(selectedPost.value?.id ?? '');
				},
				comment: async (comment) => {
					if (!selectedPost.value) return;
					await createComment(selectedPost.value?.id, comment);
				}
			}}
			time={selectedPost.value?.time ?? ''}
		/>
	</Modal>
{/await}
