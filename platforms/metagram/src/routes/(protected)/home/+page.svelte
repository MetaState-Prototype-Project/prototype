<script lang="ts">
	import { Drawer, Post } from '$lib/fragments';
	import { comments, dummyPosts } from '$lib/dummyData';
	import { onMount } from 'svelte';
	import type { CupertinoPane } from 'cupertino-pane';
	import { Comment, MessageInput } from '$lib/fragments';
	import type { CommentType, PostData } from '$lib/types';
	import { showComments } from '$lib/store/store.svelte';

	let listElement: HTMLElement;
	let visiblePosts: PostData[] = $state([]);
	let maxVisiblePosts = $state(20);
	const batchSize = 10;
	let currentIndex = $state(0);
	let loading = $state(false);
	let drawer: CupertinoPane | undefined = $state();
	let commentValue: string = $state('');
	let commentInput: HTMLInputElement | undefined = $state();
	let _comments = $state(comments);
	let activeReplyToId: string | null = $state(null);

	const loadMore = () => {
		if (loading || currentIndex >= dummyPosts.length) return;
		loading = true;
		setTimeout(() => {
			const nextBatch = dummyPosts.slice(currentIndex, currentIndex + batchSize);
			visiblePosts = [...visiblePosts, ...nextBatch];
			if (visiblePosts.length > maxVisiblePosts) {
				visiblePosts = visiblePosts.slice(visiblePosts.length - maxVisiblePosts);
			}
			currentIndex += batchSize;
			loading = false;
		}, 500);
	};

	const onScroll = () => {
		if (listElement.scrollTop + listElement.clientHeight >= listElement.scrollHeight)
			loadMore();
	};

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
					} else if (c.replies.length) {
						if (addReplyToComment(c.replies)) return true;
					}
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

	$effect(() => {
		listElement.addEventListener('scroll', onScroll);
		return () => listElement.removeEventListener('scroll', onScroll);
	});

	onMount(() => {
		loadMore();
	});
</script>

<ul bind:this={listElement} class="hide-scrollbar h-[100vh] overflow-auto">
	{#each visiblePosts as post}
		<li class="mb-6">
			<Post
				avatar={post.avatar}
				username={post.username}
				userId={post.userId}
				caption={post.caption}
				imgUris={post.imgUris}
				time={post.time}
				count={post.count}
				callback={{
					like: () => alert('like'),
					comment: () => {
						if (window.matchMedia('(max-width: 768px)').matches) {
							drawer?.present({ animate: true });
						} else {
							showComments.value = true;
						}
					},
					menu: () => alert('menu')
				}}
			/>
		</li>
	{/each}
</ul>

{#if loading}
	<p class="my-4 text-center">Loading more posts…</p>
{/if}

<Drawer bind:drawer>
	<ul class="pb-4">
		<h3 class="text-black-600 mb-6 text-center">{comments.length} Comments</h3>
		{#each _comments as comment}
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
			class="fixed start-0 bottom-4 mt-4 w-full px-5"
			variant="comment"
			src="https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250"
			bind:value={commentValue}
			{handleSend}
			bind:input={commentInput}
		/>
	</ul>
</Drawer>
