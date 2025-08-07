<script lang="ts">
	import { goto } from '$app/navigation';
	import { Drawer, Post } from '$lib/fragments';
	import { Comment, MessageInput } from '$lib/fragments';
	import { showComments } from '$lib/store/store.svelte';
	import { activePostId } from '$lib/stores/comments';
	import { error, fetchFeed, isLoading, posts, toggleLike } from '$lib/stores/posts';
	import type { CommentType, userProfile } from '$lib/types';
	import { apiClient, getAuthToken } from '$lib/utils';
	import type { AxiosError } from 'axios';
	import type { CupertinoPane } from 'cupertino-pane';
	import { onMount } from 'svelte';

	let listElement: HTMLElement;
	let drawer: CupertinoPane | undefined = $state();
	let commentValue: string = $state('');
	let commentInput: HTMLInputElement | undefined = $state();
	let _comments = $state<CommentType[]>([]);
	let activeReplyToId: string | null = $state(null);

	const onScroll = () => {
		if (listElement.scrollTop + listElement.clientHeight >= listElement.scrollHeight) {
			// TODO: Implement pagination
		}
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
		listElement.addEventListener('scroll', onScroll);
		console.log($posts);
		return () => listElement.removeEventListener('scroll', onScroll);
	});

	onMount(() => {
		fetchFeed();
		fetchProfile();
	});
</script>

<div class="flex flex-col">
	<ul bind:this={listElement} class="hide-scrollbar h-[100vh] overflow-auto">
		{#if $isLoading}
			<li class="my-4 text-center">Loading posts...</li>
		{:else if $error}
			<li class="my-4 text-center text-red-500">{$error}</li>
		{:else}
			{#each $posts.posts as post (post.id)}
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
								try {
									await toggleLike(post.id);
									await fetchFeed(); // Refresh feed to update like count
								} catch (err) {
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
