<script lang="ts">
	import { Post } from '$lib/fragments';
	import { dummyPosts } from '$lib/dummyData';
	import { onMount } from 'svelte';

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
		callback: {
			like: () => void;
			comment: () => void;
			menu: () => void;
		};
	};

	let listElement: HTMLElement;
	let visiblePosts: PostData[] = $state([]);
	let maxVisiblePosts = $state(20);
	const batchSize = 10;
	let currentIndex = $state(0);
	let loading = $state(false);

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

<ul bind:this={listElement} class="hide-scrollbar overflow-auto">
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
				callback={post.callback}
			/>
		</li>
	{/each}
</ul>

{#if loading}
	<p class="my-4 text-center">Loading more posts…</p>
{/if}
