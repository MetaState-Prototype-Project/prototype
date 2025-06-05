<script lang="ts">
	import { page } from '$app/state';
	import { comments } from '$lib/dummyData';
	import { BottomNav, Header, Comment, MessageInput, SideBar, Modal } from '$lib/fragments';
	import InputFile from '$lib/fragments/InputFile/InputFile.svelte';
	import UserRequest from '$lib/fragments/UserRequest/UserRequest.svelte';
	import { showComments } from '$lib/store/store.svelte';
	import type { CommentType } from '$lib/types';
	import { Button, Label, Textarea } from '$lib/ui';
	import InputRadio from '$lib/ui/InputRadio/InputRadio.svelte';
	import { ArrowLeft02Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import type { CupertinoPane } from 'cupertino-pane';
	let { children } = $props();

	let route = $derived(page.url.pathname);
	let heading = $state('');
	let commentValue: string = $state('');
	let commentInput: HTMLInputElement | undefined = $state();
	let _comments = $state(comments);
	let activeReplyToId: string | null = $state(null);
	let paneModal: CupertinoPane | undefined = $state();
	let files: FileList | undefined = $state();
	let imagePreviews: string[] = $state([]);
	let isAddCaption: boolean = $state(false);
	let caption: string = $state('');
	let idFromParams = $state();
	let postVisibility = $state('');

	let postVisibilityOptions = ['only followers', 'close-friends', 'anyone'];

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
		idFromParams = page.params.id;

		if (route.includes('home')) {
			heading = 'Feed';
		} else if (route.includes('discover')) {
			heading = 'Search';
		} else if (route.includes('post')) {
			heading = 'Post';
		} else if (route === `/messages/${idFromParams}`) {
			heading = 'User Name';
		} else if (route.includes('messages')) {
			heading = 'Messages';
		} else if (route.includes('settings')) {
			heading = 'Settings';
		} else if (route.includes('profile')) {
			heading = 'Profile';
		}
	});

	$effect(() => {
		if (files) {
			const readers = Array.from(files).map((file) => {
				return new Promise<string>((resolve) => {
					const reader = new FileReader();
					reader.onload = (e) => resolve(e.target?.result as string);
					reader.readAsDataURL(file);
				});
			});

			Promise.all(readers).then((previews) => {
				imagePreviews = previews;
			});
		} else {
			imagePreviews = [];
		}
	});
</script>

<main
	class={`block h-[100dvh] ${route !== '/home' && route !== '/messages' && route !== '/profile' && route !== '/settings' && !route.includes('/profile') ? 'grid-cols-[20vw_auto]' : 'grid-cols-[20vw_auto_30vw]'} md:grid`}
>
	<SideBar
		profileSrc="https://picsum.photos/200"
		handlePost={async () => {
			if (paneModal) paneModal.present({ animate: true });
		}}
	/>
	<section class="hide-scrollbar h-[100dvh] overflow-y-auto px-4 pb-16 md:px-8 md:pt-8">
		{#if route === '/profile/post'}
			<button
				class="my-4 cursor-pointer rounded-full bg-white/60 p-2 hover:bg-gray-100"
				onclick={() => window.history.back()}
			>
				<HugeiconsIcon icon={ArrowLeft02Icon} size={24} color="var(--color-black)" />
			</button>
		{:else}
			<Header
				variant={route === `/messages/${idFromParams}`
					? 'secondary'
					: route.includes('profile')
						? 'tertiary'
						: 'primary'}
				{heading}
				isCallBackNeeded={route.includes('profile')}
				callback={() => alert('Ads')}
				options={[
					{ name: 'Report', handler: () => alert('report') },
					{ name: 'Clear chat', handler: () => alert('clear') }
				]}
			/>
		{/if}
		{@render children()}
	</section>
	{#if route === '/home' || route === '/messages'}
		<aside
			class="hide-scrollbar relative hidden h-[100dvh] overflow-y-scroll border border-e-0 border-t-0 border-b-0 border-s-gray-200 px-8 pt-14 md:block"
		>
			{#if route === '/home'}
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
			{:else if route === '/messages'}
				<ul class="pb-4">
					<h2 class="text-black-600 mb-6 text-center">Other people you may know</h2>
					{#each { length: 5 } as _}
						<li class="mb-4">
							<UserRequest
								userImgSrc="https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250"
								userName="luffythethird"
								description="I’ve always wished life came at me fast. Funny how that wish never came through"
								handleFollow={async () => alert('Adsad')}
							/>
						</li>
					{/each}
				</ul>
			{/if}
		</aside>
	{/if}

	{#if route !== `/messages/${idFromParams}`}
		<BottomNav class="btm-nav" profileSrc="https://picsum.photos/200" />
	{/if}
</main>

<Modal
	bind:paneModal
	initialBreak="middle"
	handleDismiss={() => {
		(files = undefined), (isAddCaption = false);
	}}
>
	<h1 class="mb-6 font-semibold text-black">Upload a Photo</h1>
	{#if !isAddCaption}
		{#if !files}
			<InputFile class="mb-4 h-[40vh]" bind:files accept="images/*" multiple={true} />
		{:else}
			<div class="mb-4 grid grid-cols-3 gap-2">
				{#each imagePreviews as src}
					<div class="aspect-[4/5] overflow-hidden rounded-lg border">
						<!-- svelte-ignore a11y_img_redundant_alt -->
						<img {src} alt="Selected image" class="h-full w-full object-cover" />
					</div>
				{/each}
			</div>
		{/if}
	{:else if isAddCaption}
		<Label>Add a Caption</Label>
		<Textarea class="mb-4" bind:value={caption} placeholder="enter caption" />
		<div class="mb-4 flex items-center gap-2">
			{#each imagePreviews as src}
				<div class="h-[100px] w-[80px] overflow-hidden rounded-lg border">
					<!-- svelte-ignore a11y_img_redundant_alt -->
					<img {src} alt="Selected image" class="h-[100px] w-[80px] object-cover" />
				</div>
			{/each}
		</div>
		<h3 class="text-black-800 mt-20 mb-2">Who can see the post?</h3>
		{#each postVisibilityOptions as option, i}
			<div class="mb-2 flex w-[50%] items-center justify-between">
				<Label for={option + i}>{option}</Label>
				<InputRadio
					name="post-visibility"
					id={option + i}
					value={option}
					bind:selected={postVisibility}
				/>
			</div>
		{/each}
	{/if}
	{#if files}
		<div class="grid grid-cols-2 gap-2">
			<Button
				variant="secondary"
				size="sm"
				callback={async () => {
					files = undefined;
					isAddCaption = false;
					paneModal?.destroy({ animate: true });
				}}>Cancel</Button
			>
			<Button
				variant="secondary"
				size="sm"
				callback={async () => {
					isAddCaption = true;
				}}>Next</Button
			>
		</div>
	{/if}
</Modal>
