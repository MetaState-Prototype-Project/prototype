<script lang="ts">
	import { goto } from '$app/navigation';
	import { Drawer, Post } from '$lib/fragments';
	import { Comment, MessageInput } from '$lib/fragments';
	import MainPanel from '$lib/fragments/MainPanel/MainPanel.svelte';
	import { showComments } from '$lib/store/store.svelte';
	import { activePostId, comments, createComment, fetchComments } from '$lib/stores/comments';
	import {
		error,
		fetchFeed,
		hasMore,
		isLoading,
		isLoadingMore,
		loadMoreFeed,
		posts,
		resetFeed,
		toggleLike
	} from '$lib/stores/posts';
	import type { userProfile } from '$lib/types';
	import { apiClient, getAuthToken } from '$lib/utils';
	import type { AxiosError } from 'axios';
	import type { CupertinoPane } from 'cupertino-pane';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';

	let drawer: CupertinoPane | undefined = $state();
	let commentValue: string = $state('');
	let commentInput: HTMLInputElement | undefined = $state();
	let isCommentsLoading = $state(false);
	let commentsError = $state<string | null>(null);
	let isDrawerOpen = $state(false);

	const sentinel = (node: HTMLElement) => {
		// The sentinel is a direct child of the scrollable ul
		const scrollContainer = node.parentElement;

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						const hasMorePosts = get(hasMore);
						const loading = get(isLoading);
						const loadingMore = get(isLoadingMore);

						if (hasMorePosts && !loading && !loadingMore) {
							console.log('Triggering loadMoreFeed');
							loadMoreFeed();
						}
					}
				}
			},
			{
				root: scrollContainer as HTMLElement,
				rootMargin: '200px'
			}
		);

		observer.observe(node);

		return {
			destroy() {
				observer.disconnect();
			}
		};
	};

	let profile = $state<userProfile | null>(null);
	const handleSend = async () => {
		if (!$activePostId || !commentValue.trim()) return;

		try {
			await createComment($activePostId, commentValue);
			commentValue = '';
		} catch (err) {
			console.error('Failed to create comment:', err);
		}
	};

	async function fetchProfile() {
		try {
			if (!getAuthToken()) {
				goto('/auth');
				return;
			}
			const response = await apiClient.get('/api/users').catch((e: AxiosError) => {
				if (e.response?.status === 401) {
					goto('/auth');
				}
			});
			if (!response) return;
			profile = response.data;
		} catch (err) {
			console.log(err instanceof Error ? err.message : 'Failed to load profile');
		}
	}

	// Watch for changes in showComments to fetch comments when opened
	$effect(() => {
		if (showComments.value && $activePostId) {
			const targetPostId = $activePostId;
			isCommentsLoading = true;
			commentsError = null;
			fetchComments($activePostId)
				.catch((err) => {
					if ($activePostId === targetPostId) {
						commentsError = err.message;
					}
				})
				.finally(() => {
					if ($activePostId === targetPostId) {
						isCommentsLoading = false;
					}
				});
		}
	});

	onMount(() => {
		resetFeed();
		fetchFeed(1, 10, false);
		fetchProfile();
	});
</script>

<MainPanel>
	<ul class="hide-scrollbar h-screen overflow-auto pb-24 md:h-dvh md:pb-0">
		{#if $isLoading && $posts.length === 0}
			<li class="my-4 text-center">Loading posts...</li>
		{:else if $error}
			<li class="my-4 text-center text-red-500">{$error}</li>
		{:else}
			{#each $posts as post (post.id)}
				<li class="mb-6">
					<Post
						avatar={post.author.avatarUrl}
						username={post.author.name ?? post.author.handle}
						userId={post.author.id}
						imgUris={post.images}
						isLiked={post.likedBy.find((p) => p.id === profile?.id) !== undefined}
						text={post.text}
						time={new Date(post.createdAt).toLocaleDateString()}
						count={{ likes: post.likedBy.length, comments: post.comments.length }}
						callback={{
							like: async () => {
								if (!profile) return;

								// Capture profile and post ID for reliable lookup
								const currentProfile = profile;
								const targetPostId = post.id;

								// Optimistically update the post in the store
								const currentPosts = get(posts);
								const currentPostIndex = currentPosts.findIndex(
									(p) => p.id === targetPostId
								);

								if (currentPostIndex === -1) return;

								const currentPost = currentPosts[currentPostIndex];
								const isCurrentlyLiked = currentPost.likedBy.some(
									(p) => p.id === currentProfile.id
								);

								// Save original state for potential rollback
								const originalLikedBy = [...currentPost.likedBy];

								// Optimistically update: toggle liked state and adjust like count
								posts.update((posts) => {
									const updatedPosts = [...posts];
									const postIndex = updatedPosts.findIndex(
										(p) => p.id === targetPostId
									);

									if (postIndex === -1) return updatedPosts;

									const postToUpdate = { ...updatedPosts[postIndex] };

									if (isCurrentlyLiked) {
										// Unlike: remove current user from likedBy
										postToUpdate.likedBy = postToUpdate.likedBy.filter(
											(p) => p.id !== currentProfile.id
										);
									} else {
										// Like: add current user to likedBy
										postToUpdate.likedBy = [
											...postToUpdate.likedBy,
											currentProfile
										];
									}

									updatedPosts[postIndex] = postToUpdate;
									return updatedPosts;
								});

								// Call toggleLike in the background
								try {
									await toggleLike(targetPostId);
								} catch (err) {
									// On error, revert the optimistic update
									posts.update((posts) => {
										const updatedPosts = [...posts];
										const postIndex = updatedPosts.findIndex(
											(p) => p.id === targetPostId
										);

										if (postIndex === -1) return updatedPosts;

										const postToRevert = { ...updatedPosts[postIndex] };
										postToRevert.likedBy = originalLikedBy;
										updatedPosts[postIndex] = postToRevert;
										return updatedPosts;
									});
									console.error('Failed to toggle like:', err);
								}
							},
							comment: () => {
								activePostId.set(post.id);
								if (window.matchMedia('(max-width: 768px)').matches) {
									showComments.value = true;
									isDrawerOpen = true;
									drawer?.present({ animate: true });
								} else {
									showComments.value = true;
								}
							},
							menu: () => alert('menu')
						}}
						options={[{ name: 'Report', handler: () => alert('asd') }]}
					/>
				</li>
			{/each}
			{#if $isLoadingMore}
				<li class="my-8 flex flex-col items-center justify-center py-8">
					<div
						class="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
					></div>
					<p class="text-base font-medium text-gray-700">Loading more posts...</p>
				</li>
			{/if}
			{#if !$hasMore && $posts.length > 0 && !$isLoadingMore}
				<li class="my-4 text-center text-gray-500">No more posts to load</li>
			{/if}
			{#if $hasMore && !$isLoadingMore}
				<li class="h-1 w-full" use:sentinel></li>
			{/if}
		{/if}
	</ul>
	<!-- Desktop Comments Sidebar -->
	{#snippet RightPanel()}
		{#if !showComments.value}
			<div class="flex h-full items-center justify-center text-gray-400">
				<p class="text-center">Select a post to view comments</p>
			</div>
		{:else}
			<h3 class="text-black-600 mb-6 text-center">
				{$comments.length} Comments
			</h3>
			{#if isCommentsLoading}
				<p class="text-center text-gray-500">Loading comments...</p>
			{:else if commentsError}
				<p class="text-center text-red-500">{commentsError}</p>
			{:else}
				<ul>
					{#each $comments as comment (comment.id)}
						<li class="mb-4">
							{@render SingleComment({ comment })}
						</li>
					{/each}
				</ul>
			{/if}
			<MessageInput
				class="sticky start-0 bottom-4 mt-4 w-full px-2"
				variant="comment"
				src={profile?.avatarUrl ?? '/images/user.png'}
				bind:value={commentValue}
				{handleSend}
				bind:input={commentInput}
			/>
		{/if}
	{/snippet}

	<!-- Mobile Comments Drawer -->
	<Drawer
		bind:drawer
		onClose={() => {
			isDrawerOpen = false;
			showComments.value = false;
		}}
	>
		<h3 class="text-black-600 mb-6 text-center">{$comments.length} Comments</h3>
		{#if isCommentsLoading}
			<p class="text-center text-gray-500">Loading comments...</p>
		{:else if commentsError}
			<p class="text-center text-red-500">{commentsError}</p>
		{:else}
			<ul class="pb-32">
				{#each $comments as comment (comment.id)}
					<li class="mb-4">
						{@render SingleComment({ comment })}
					</li>
				{/each}
			</ul>
		{/if}
	</Drawer>

	{#if showComments.value && isDrawerOpen}
		<div
			class="fixed right-0 bottom-0 left-0 z-50 border-t border-gray-200 bg-white px-5 py-4 md:hidden"
		>
			<MessageInput
				class="w-full"
				variant="comment"
				src={profile?.avatarUrl ?? '/images/user.png'}
				bind:value={commentValue}
				{handleSend}
				bind:input={commentInput}
			/>
		</div>
	{/if}
</MainPanel>

{#snippet SingleComment({
	comment
}: {
	comment: {
		id: string;
		text: string;
		createdAt: string;
		author: { avatarUrl?: string; name?: string; handle: string };
	};
})}
	<Comment
		comment={{
			userImgSrc: comment.author?.avatarUrl ?? '/images/user.png',
			name: comment.author?.name || comment.author?.handle || 'Unknown User',
			commentId: comment.id,
			comment: comment.text,
			isUpVoted: false,
			isDownVoted: false,
			upVotes: 0,
			time: new Date(comment.createdAt).toLocaleDateString(),
			replies: []
		}}
		handleReply={() => {
			commentInput?.focus();
		}}
	/>
{/snippet}
