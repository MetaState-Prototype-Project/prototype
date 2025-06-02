<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { comments } from '$lib/dummyData';
	import { BottomNav, Header, Comment, MessageInput, SideBar } from '$lib/fragments';
	import { Settings } from '$lib/icons';
	import { showComments } from '$lib/store/store.svelte';
	import type { CommentType } from '$lib/types';
	let { children } = $props();

	let route = $derived(page.url.pathname);
	let heading = $state('');
	let commentValue: string = $state('');
	let commentInput: HTMLInputElement | undefined = $state();
	let _comments = $state(comments);
	let activeReplyToId: string | null = $state(null);
	let chatFriendId = $state();

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
		chatFriendId = page.params.id;

		if (route.includes('home')) {
			heading = 'Feed';
		} else if (route.includes('discover')) {
			heading = 'Search';
		} else if (route.includes('post')) {
			heading = 'Post';
		} else if (route === `/messages/${chatFriendId}`) {
			heading = 'User Name';
		} else if (route.includes('messages')) {
			heading = 'Messages';
		} else if (route.includes('settings')) {
			heading = 'Settings';
		} else if (route.includes('profile')) {
			heading = 'Profile';
		}
	});
</script>

<main
	class={`block h-[100dvh] ${route !== '/home' ? 'grid-cols-[20vw_auto]' : 'grid-cols-[20vw_auto_30vw]'} md:grid`}
>
	<SideBar profileSrc="https://picsum.photos/200" handlePost={async () => alert('adas')} />
	<section class="hide-scrollbar h-[100dvh] overflow-y-auto px-4 pb-8 md:px-8 md:pt-8">
		<div class="flex items-center justify-between">
			<Header
				variant={route === `/messages/${chatFriendId}` ? 'secondary' : 'primary'}
				{heading}
				options={[
					{ name: 'Report', handler: () => alert('report') },
					{ name: 'Clear chat', handler: () => alert('clear') }
				]}
			/>
			{#if route === '/profile'}
				<div class="mb-6 flex md:hidden">
					<button
						type="button"
						class="flex items-center gap-2"
						onclick={() => goto(`/settings`)}
					>
						<Settings size="24px" color="var(--color-brand-burnt-orange)" />
					</button>
				</div>
			{/if}
		</div>
		{@render children()}
	</section>
	{#if route === '/home'}
		<aside
			class="hide-scrollbar relative hidden h-[100dvh] overflow-y-scroll border border-e-0 border-t-0 border-b-0 border-s-gray-200 px-8 pt-14 md:block"
		>
			{#if showComments.value}
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
						class="sticky start-0 bottom-4 mt-4 w-full px-2"
						variant="comment"
						src="https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250"
						bind:value={commentValue}
						{handleSend}
						bind:input={commentInput}
					/>
				</ul>
			{/if}
		</aside>
	{/if}

	{#if route !== `/messages/${chatFriendId}`}
		<BottomNav class="btm-nav" profileSrc="https://picsum.photos/200" />
	{/if}
</main>
