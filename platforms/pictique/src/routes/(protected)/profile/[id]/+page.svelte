<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { PostModal, Profile } from '$lib/fragments';
	import { selectedPost } from '$lib/store/store.svelte';
	import { comments as commentsStore, createComment, fetchComments } from '$lib/stores/comments';
	import { toggleLike } from '$lib/stores/posts';
	import type { PostData, userProfile } from '$lib/types';
	import { Modal } from '$lib/ui';
	import { apiClient, getAuthId } from '$lib/utils/axios';
	import { onMount } from 'svelte';

	interface Comment {
		id: string;
		text: string;
		createdAt: string;
		author: {
			id: string;
			handle: string;
			name: string;
			avatarUrl: string;
		};
	}

	let profileId = $derived(page.params.id);
	let profile = $state<userProfile | null>(null);
	let error = $state<string | null>(null);
	let loading = $state(true);
	let ownerId: string | null = $derived(getAuthId());
	let isFollowing = $state(false);
	let didFollowed = $state(false);
	let ownerProfile = $derived.by(async () => {
		if (ownerId) {
			const response = await apiClient.get<userProfile>(`/api/users/${ownerId}`);
			console.log('Owner Profile:', response.data);
			return response.data;
		}
	});
	async function fetchProfile() {
		try {
			loading = true;
			error = null;
			const response = await apiClient.get<userProfile>(`/api/users/${profileId}`);
			console.log('Fetched Profile:', response.data);
			profile = response.data;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load profile';
		} finally {
			loading = false;
		}
	}

	async function handleFollow() {
		try {
			isFollowing = true;
			const response = await apiClient.post(`/api/users/${profileId}/follow`);
			if (response) {
				didFollowed = true;
				// await fetchProfile();
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to follow user';
			didFollowed = false;
		} finally {
			isFollowing = false;
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

	async function handlePostClick(post: PostData) {
		selectedPost.value = post;
		try {
			// Trigger the store to fetch comments for this specific post
			await fetchComments(post.id);
		} catch (err) {
			console.error('Error loading comments:', err);
		}
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
			bind:isFollowing
			bind:didFollowed
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
			isLiked={ownerProfile
				? ((selectedPost.value as any)?.likedBy?.some(
						(user: any) => user.id === ownerProfile.id
					) ?? false)
				: false}
			callback={{
				like: async () => {
					if (!selectedPost.value?.id) return;
					try {
						const result = await toggleLike(selectedPost.value.id);
						if (selectedPost.value && result?.likedBy) {
							(selectedPost.value as any).likedBy = result.likedBy;
						}
					} catch (err) {
						console.error('Failed to toggle like:', err);
					}
				},
				comment: async (comment) => {
					if (!selectedPost.value) return;
					try {
						await createComment(selectedPost.value.id, comment);
					} catch (err) {
						console.error('Failed to create comment:', err);
					}
				}
			}}
			comments={$commentsStore}
			time={selectedPost.value?.time ?? ''}
		/>
	</Modal>
{/await}
