<script lang="ts">
	import { Drawer, Post } from '$lib/fragments';
	import { dummyPosts } from '$lib/dummyData';
	import { onMount } from 'svelte';
	import type { CupertinoPane } from 'cupertino-pane';
	import { Comment, MessageInput } from '$lib/fragments';

	type PostData = {
		id: number;
		avatar: string;
		username: string;
		imgUri: string;
		postAlt: string;
		text: string;
		time: string;
		count: {
			likes: number;
			comments: number;
		};
	};

	let listElement: HTMLElement;
	let visiblePosts: PostData[] = $state([]);
	let maxVisiblePosts = $state(20);
	const batchSize = 10;
	let currentIndex = $state(0);
	let loading = $state(false);
	let drawer: CupertinoPane | undefined = $state();
	let commentValue: string = $state('');
	let commentInput: HTMLInputElement | undefined = $state();

	const comments = Array.from({length: 50}, (_, i) => ({
		userImgSrc: "https://picsum.photos/800",
		name: "user" + (i + 1),
		commentId: i + 1,
		comment: "this is the dummy comment which is commented by user" + (i + 1),
		replies: [
			{
				userImgSrc: "https://picsum.photos/800",
				name: "user" + (i + 1) + "x",
				commentId: (i + 1) + "x",
				comment: "this is the dummy reply which is replied by another" + i + "x",
			},
			{
				userImgSrc: "https://picsum.photos/800",
				name: "user" + (i + 1) + "y",
				commentId: i + 1 + "y",
				comment: "this is the dummy reply which is replied by another" + i + "y",
			}
			,{
				userImgSrc: "https://picsum.photos/800",
				name: "user" + (i + 1) + "z",
				commentId: i + 1 + "z",
				comment: "this is the dummy reply which is replied by another" + i + "z",
			}
		]
	}))

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
				imgUri={post.imgUri}
				postAlt={post.postAlt}
				text={post.text}
				time={post.time}
				count={post.count}
				callback={{
					like: () => alert('like'),
					comment: () => drawer?.present({ animate: true }),
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
		<h3 class="text-black-600 mb-6 text-center">32 Comments</h3>
		{#each comments as comment}
		<li class="mb-4">
			<Comment
			isLiked={false}
			isDisliked={false}
			likeCount={0}
			name={comment.name}
			comment={comment.comment}
			imgSrc={comment.userImgSrc}
			handleReply={() => commentInput?.focus()}
			time={'2 minutes ago'}
			/>
			{#if comment.replies}
			<ul class="ms-12 mt-4">
					{#each comment.replies as reply}
					<li class="mb-4">
						<Comment
						isLiked={false}
						isDisliked={false}
						likeCount={0}
						name={reply.name}
						comment={reply.comment}
						imgSrc={reply.userImgSrc}
						handleReply={() => commentInput?.focus()}
						time={'2 minutes ago'}
						/>
					</li>
				{/each}
				</ul>
			{/if}
		</li>
		{/each}
		<MessageInput
			class="mt-4"
			variant="comment"
			src="https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250"
			bind:value={commentValue}
			handleSend={async () => alert('sdfs')}
			bind:input={commentInput}
		/>
	</ul>
</Drawer>
