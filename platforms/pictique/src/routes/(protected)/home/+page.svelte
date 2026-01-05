<script lang="ts">
	import { goto } from '$app/navigation';
	import { Drawer, Post } from '$lib/fragments';
	import { Comment, MessageInput } from '$lib/fragments';
	import { showComments } from '$lib/store/store.svelte';
	import { activePostId } from '$lib/stores/comments';
	import {
		currentPage,
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
	import type { CommentType, userProfile } from '$lib/types';
	import { apiClient, getAuthToken } from '$lib/utils';
	import type { AxiosError } from 'axios';
	import type { CupertinoPane } from 'cupertino-pane';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';

	let listElement: HTMLElement;
	let sentinelElement: HTMLElement | undefined = $state();
	let drawer: CupertinoPane | undefined = $state();
	let commentValue: string = $state('');
	let commentInput: HTMLInputElement | undefined = $state();
	let _comments = $state<CommentType[]>([]);
	let activeReplyToId: string | null = $state(null);
	let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

	const sentinel = (node: HTMLElement) => {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						const hasMorePosts = get(hasMore);
						const loading = get(isLoading);
						const loadingMore = get(isLoadingMore);

						if (hasMorePosts && !loading && !loadingMore) {
							loadMoreFeed();
						}
					}
				}
			},
			{ root: listElement, rootMargin: '200px' }
		);

		observer.observe(node);

		return {
			destroy() {
				observer.disconnect();
			}
		};
	};

	const onScroll = () => {
		if (scrollTimeout) {
			clearTimeout(scrollTimeout);
		}

		scrollTimeout = setTimeout(() => {
			if (!listElement) return;

			const scrollTop = listElement.scrollTop;
			const scrollHeight = listElement.scrollHeight;
			const clientHeight = listElement.clientHeight;
			const threshold = 200; // Load more when within 200px of bottom

			// Check if scrolled near bottom
			const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
			const isNearBottom = distanceFromBottom <= threshold;

			if (isNearBottom) {
				const hasMorePosts = get(hasMore);
				const loading = get(isLoading);
				const loadingMore = get(isLoadingMore);

				if (hasMorePosts && !loading && !loadingMore) {
					loadMoreFeed();
				}
			}
		}, 100); // Debounce scroll events
	};
	let profile = $state<userProfile | null>(null);
	const handleSend = async () => {
		const newComment = {
			userImgSrc: 'https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250',
			name: 'You',
			commentId: Date.now().toString(),
			comment: commentValue,
			isUpVoted: false,
			isDownVoted: false,
			upVotes: 0,
			time: 'Just now',
			replies: []
		};

		if (activeReplyToId) {
			// Find the parent comment by id and push reply
			const addReplyToComment = (commentsArray: CommentType[]) => {
				for (const c of commentsArray) {
					if (c.commentId === activeReplyToId) {
						c.replies.push(newComment);
						return true;
					}
					if (c.replies.length && addReplyToComment(c.replies)) return true;
				}
				return false;
			};
			addReplyToComment(_comments);
		} else {
			// If no activeReplyToId, add as a new parent comment
			_comments = [newComment, ..._comments];
		}
		commentValue = '';
		activeReplyToId = null;
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

	$effect(() => {
		if (!listElement) return;

		const element = listElement;
		element.addEventListener('scroll', onScroll, { passive: true });

		return () => {
			element.removeEventListener('scroll', onScroll);
			if (scrollTimeout) {
				clearTimeout(scrollTimeout);
				scrollTimeout = null;
			}
		};
	});

	onMount(() => {
		resetFeed();
		fetchFeed(1, 10, false).then(() => {
			// Check if we need to load more immediately (if content doesn't fill viewport)
			setTimeout(() => {
				if (listElement) {
					const scrollHeight = listElement.scrollHeight;
					const clientHeight = listElement.clientHeight;
					if (
						scrollHeight <= clientHeight &&
						get(hasMore) &&
						!get(isLoading) &&
						!get(isLoadingMore)
					) {
						loadMoreFeed();
					}
				}
			}, 100);
		});
		fetchProfile();
	});
</script>

<div class="flex flex-col">
	<ul bind:this={listElement} class="hide-scrollbar h-[100vh] overflow-auto">
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
								
								// Optimistically update the post in the store
								const currentPosts = get(posts);
								const postIndex = currentPosts.findIndex((p) => p.id === post.id);
								
								if (postIndex === -1) return;
								
								const currentPost = currentPosts[postIndex];
								const isCurrentlyLiked = currentPost.likedBy.some((p) => p.id === profile.id);
								
								// Save original state for potential rollback
								const originalLikedBy = [...currentPost.likedBy];
								
								// Optimistically update: toggle liked state and adjust like count
								posts.update((posts) => {
									const updatedPosts = [...posts];
									const postToUpdate = { ...updatedPosts[postIndex] };
									
									if (isCurrentlyLiked) {
										// Unlike: remove current user from likedBy
										postToUpdate.likedBy = postToUpdate.likedBy.filter((p) => p.id !== profile.id);
									} else {
										// Like: add current user to likedBy
										postToUpdate.likedBy = [...postToUpdate.likedBy, profile];
									}
									
									updatedPosts[postIndex] = postToUpdate;
									return updatedPosts;
								});
								
								// Call toggleLike in the background
								try {
									await toggleLike(post.id);
								} catch (err) {
									// On error, revert the optimistic update
									posts.update((posts) => {
										const updatedPosts = [...posts];
										const postToRevert = { ...updatedPosts[postIndex] };
										postToRevert.likedBy = originalLikedBy;
										updatedPosts[postIndex] = postToRevert;
										return updatedPosts;
									});
									console.error('Failed to toggle like:', err);
								}
							},
							comment: () => {
								if (window.matchMedia('(max-width: 768px)').matches) {
									drawer?.present({ animate: true });
								} else {
									showComments.value = true;
									activePostId.set(post.id);
								}
							},
							menu: () => alert('menu')
						}}
						options={[{ name: 'Report', handler: () => alert('asd') }]}
					/>
				</li>
			{/each}
			{#if $isLoadingMore}
				<li class="my-4 text-center">Loading more posts...</li>
			{/if}
			{#if !$hasMore && $posts.length > 0 && !$isLoadingMore}
				<li class="my-4 text-center text-gray-500">No more posts to load</li>
			{/if}
			{#if $hasMore && !$isLoadingMore}
				<li class="h-1 w-full" bind:this={sentinelElement} use:sentinel></li>
			{/if}
		{/if}
	</ul>
</div>

<Drawer bind:drawer>
	<ul class="pb-4">
		<h3 class="text-black-600 mb-6 text-center">{_comments.length} Comments</h3>
		{#each _comments as comment (comment.commentId)}
			<li class="mb-4">
				<Comment
					{comment}
					handleReply={() => {
						activeReplyToId = comment.commentId;
						commentInput?.focus();
					}}
				/>
			</li>
		{/each}
		<MessageInput
			class="fixed bottom-4 start-0 mt-4 w-full px-5"
			variant="comment"
			src="https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250"
			bind:value={commentValue}
			{handleSend}
			bind:input={commentInput}
		/>
	</ul>
</Drawer>
