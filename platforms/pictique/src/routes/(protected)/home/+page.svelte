<script lang="ts">
	import { Drawer, Post } from '$lib/fragments';
	import { onMount } from 'svelte';
	import type { CupertinoPane } from 'cupertino-pane';
	import { Comment, MessageInput } from '$lib/fragments';
	import type { userProfile } from '$lib/types';
	import { showComments } from '$lib/store/store.svelte';
	import { posts, isLoading, error, fetchFeed, toggleLike } from '$lib/stores/posts';
	import { activePostId, comments, createComment } from '$lib/stores/comments';
	import { apiClient, getAuthId } from '$lib/utils';

	let listElement: HTMLElement;
	let drawer: CupertinoPane | undefined = $state();
	let commentValue: string = $state('');
	let commentInput: HTMLInputElement | undefined = $state();
	let activeReplyToId: string | null = $state(null);
	let followError = $state<string | null>(null);
	let ownerId: string | null = $state(null);
	let profile = $state<userProfile | null>(null);
	let loading = $state(true);
	let isCommentsLoading = $state(false);
	let commentsError = $state<string | null>(null);

	const onScroll = () => {
		if (listElement.scrollTop + listElement.clientHeight >= listElement.scrollHeight) {
			// TODO: Implement pagination
		}
	};

	const handleSend = async () => {
		console.log($activePostId, commentValue);
		if (!$activePostId || !commentValue.trim()) return;

		try {
			await createComment($activePostId, commentValue);
			commentValue = '';
			activeReplyToId = null;
		} catch (err) {
			console.error('Failed to create comment:', err);
		}
	};

	async function handleFollow(profileId: string) {
		try {
			await apiClient.post(`/api/users/${profileId}/follow`);
		} catch (err) {
			followError = err instanceof Error ? err.message : 'Failed to follow user';
			console.log(followError);
		}
	}

	async function fetchProfile() {
		try {
			loading = true;
			const response = await apiClient.get(`/api/users/${ownerId}`);
			profile = response.data;
			console.log(JSON.stringify(profile));
		} catch (err) {
			console.log(err instanceof Error ? err.message : 'Failed to load profile');
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		listElement.addEventListener('scroll', onScroll);
		return () => listElement.removeEventListener('scroll', onScroll);
	});

	onMount(() => {
		ownerId = getAuthId();
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
						username={post.author.handle}
						userId = {post.author.id}
						imgUris={post.images}
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
						options = {[{name: "Follow",handler: () => handleFollow(post.author.id)}]}
					/>
				</li>
			{/each}
		{/if}
	</ul>
</div>

<Drawer bind:drawer>
	{#if showComments.value}
					<ul class="pb-4">
						<h3 class="text-black-600 mb-6 text-center">{$comments.length} Comments</h3>
						{#if isCommentsLoading}
							<li class="text-center text-gray-500">Loading comments...</li>
						{:else if commentsError}
							<li class="text-center text-red-500">{commentsError}</li>
						{:else}
							{#each $comments as comment}
								<li class="mb-4">
									<Comment
										comment={{
											userImgSrc:
												comment.author.avatarUrl ||
												'https://picsum.photos/200/200',
											name: comment.author.name || comment.author.handle,
											commentId: comment.id,
											comment: comment.text,
											isUpVoted: false,
											isDownVoted: false,
											upVotes: 0,
											time: new Date(comment.createdAt).toLocaleDateString(),
											replies: []
										}}
										handleReply={() => {
											activeReplyToId = comment.id;
											commentInput?.focus();
										}}
									/>
								</li>
							{/each}
						{/if}
						<MessageInput
							class="sticky start-0 bottom-4 mt-4 w-full px-2"
							variant="comment"
							src={profile?.avatarUrl || 'https://picsum.photos/200/200'}
							bind:value={commentValue}
							{handleSend}
							bind:input={commentInput}
						/>
					</ul>
				{/if}
</Drawer>
