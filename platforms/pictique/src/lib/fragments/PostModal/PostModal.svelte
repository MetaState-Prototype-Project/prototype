<script lang="ts">
	import { goto } from '$app/navigation';
	import { Like } from '$lib/icons';
	import CommentIcon from '$lib/icons/CommentIcon.svelte';
	import type { userProfile } from '$lib/types';
	import { Avatar } from '$lib/ui';
	import { cn } from '$lib/utils';
	import { ArrowLeftIcon, ArrowRightIcon, RecordIcon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { MessageInput } from '..';

	interface IPostProps extends HTMLAttributes<HTMLElement> {
		avatar: string;
		username: string;
		userId?: string;
		imgUris: string[];
		text: string;
		isLiked?: boolean;
		count?: {
			likes: number;
			comments: number;
		};
		callback: {
			like: () => Promise<void>;
			comment: (comment: string) => Promise<void>;
		};
		time: string;
		comments?: {
			id: string;
			text: string;
			author: {
				id: string;
				handle: string;
				name: string;
				avatarUrl: string;
			};
			createdAt: string;
		}[];
		options?: Array<{ name: string; handler: () => void }>;
		ownerProfile?: userProfile;
	}

	function pairAndJoinChunks(chunks: string[]): string[] {
		const result: string[] = [];

		console.log('chunks', chunks);
		for (let i = 0; i < chunks.length; i += 2) {
			const dataPart = chunks[i];
			const chunkPart = chunks[i + 1];

			if (dataPart && chunkPart) {
				if (dataPart.startsWith('data:')) {
					result.push(`${dataPart},${chunkPart}`);
				} else {
					result.push(dataPart);
					result.push(chunkPart);
				}
			} else {
				if (!dataPart.startsWith('data:')) result.push(dataPart);
				console.warn(`Skipping incomplete pair at index ${i}`);
			}
		}
		console.log('result', result);

		return result;
	}

	const {
		avatar,
		userId,
		username,
		imgUris: uris,
		text,
		count,
		callback,
		time,
		isLiked,
		comments,
		ownerProfile,
		...restProps
	}: IPostProps = $props();

	let imgUris = $derived(pairAndJoinChunks(uris));
	let galleryRef: HTMLDivElement | undefined = $state();
	let currentIndex = $state(0);
	let commentValue = $state('');
	let displayMobileCommentBox = $state(false);

	function scrollLeft() {
		if (!galleryRef) return;
		galleryRef.scrollBy({ left: -galleryRef.clientWidth, behavior: 'smooth' });
	}

	function scrollRight() {
		if (!galleryRef) return;
		galleryRef.scrollBy({ left: galleryRef.clientWidth, behavior: 'smooth' });
	}

	function handleScroll() {
		if (!galleryRef) return;
		const scrollLeft = galleryRef.scrollLeft;
		const galleryWidth = galleryRef.clientWidth;
		const newIndex = Math.round(scrollLeft / galleryWidth);
		currentIndex = newIndex;
	}

	function handleImageError(event: Event) {
		const img = event.target as HTMLImageElement;
		img.src = 'https://picsum.photos/200';
	}

	const handleSend = async () => {
		if (!commentValue.trim()) return;
		await callback.comment(commentValue);
		commentValue = '';
	};
</script>

<article {...restProps} class={cn(['flex w-full gap-10', restProps.class])}>
	<div class="flex flex-col gap-4 md:w-3/5 lg:w-2/3">
		<div class="flex w-full items-center justify-between md:hidden">
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="flex items-center justify-between gap-2"
				onclick={() => goto(`/profile/${userId}`)}
			>
				{#key avatar}
					<Avatar src={avatar ?? '/images/user.png'} alt={username} size="sm"></Avatar>
				{/key}
				<h2>{username}</h2>
			</div>
		</div>
		{#if imgUris.length > 0}
			<div class="relative">
				{#if imgUris.length > 1}
					<button
						onclick={scrollLeft}
						class="absolute start-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white p-2 shadow hover:bg-gray-200 md:inline-block"
					>
						<HugeiconsIcon icon={ArrowLeftIcon} size={20} color="black" />
					</button>
				{/if}
				<div
					bind:this={galleryRef}
					onscroll={handleScroll}
					class="hide-scrollbar flex aspect-[4/5] snap-x snap-mandatory flex-nowrap gap-2 overflow-hidden overflow-x-scroll rounded-4xl md:aspect-[16/9]"
				>
					{#each imgUris as img, i (i)}
						<div
							class="aspect-[4/5] h-full w-full snap-center md:aspect-[16/9] md:h-screen"
						>
							<img
								src={img}
								alt={text}
								class="h-full w-full rounded-4xl object-cover md:h-auto md:min-w-96"
								onerror={handleImageError}
							/>
						</div>
					{/each}
				</div>
				{#if imgUris.length > 1}
					<div
						class="absolute start-[50%] bottom-4 mt-2 flex translate-x-[-50%] items-center justify-center gap-1"
					>
						{#if imgUris.length > 1}
							<div class="mt-2 flex items-center justify-center gap-1">
								<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
								{#each imgUris as _, i (i)}
									<div
										class={`h-1.5 w-1.5 rounded-full ${currentIndex === i ? 'bg-white' : 'bg-black-600'}`}
									></div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
				{#if imgUris.length > 1}
					<button
						onclick={scrollRight}
						class="absolute end-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white p-2 shadow hover:bg-gray-200 md:inline-block"
					>
						<HugeiconsIcon icon={ArrowRightIcon} size={20} color="black" />
					</button>
				{/if}
			</div>
		{/if}
		{#if count}
			<p class="text-black/80 md:hidden">{text}</p>
			<p class="text-black/60 md:hidden">
				{new Date(time).toLocaleDateString()}
			</p>
		{/if}
		<div class="flex w-full items-center justify-between md:hidden">
			<div class="flex gap-4">
				<button
					class="cursor-pointer rounded-2xl bg-gray-100 px-4 py-3 hover:bg-gray-200"
					onclick={callback.like}
				>
					<Like
						size="24px"
						color="var(--color-red-500"
						fill={isLiked ? 'var(--color-red-500)' : 'white'}
					/>
				</button>
				<button
					class="cursor-pointer rounded-2xl bg-gray-100 px-4 py-3 hover:bg-gray-200"
					onclick={() => {
						displayMobileCommentBox = !displayMobileCommentBox;
					}}
				>
					<CommentIcon size="24px" color="black" fill="transparent" />
				</button>
			</div>
			{#if count && count.likes && count.comments}
				<div class="flex items-center justify-between gap-3 text-lg text-black/40">
					<p class="subtext text-black-400">{count?.likes ?? 0} likes</p>
					<HugeiconsIcon
						icon={RecordIcon}
						size={5}
						strokeWidth={30}
						color="var(--color-black-400)"
						className="rounded-full"
					/>
					<p class="subtext text-black-400">{count?.comments ?? 0} comments</p>
				</div>
			{/if}
		</div>
		{#if displayMobileCommentBox}
			<MessageInput
				variant="comment"
				src={ownerProfile?.avatarUrl ?? '/images/user.png'}
				bind:value={commentValue}
				{handleSend}
			/>
		{/if}
	</div>
	<div class="hidden flex-col gap-4 md:flex md:aspect-[16/9] md:w-2/5 lg:w-1/3">
		<div class="flex w-full items-center justify-between">
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="flex items-center justify-between gap-2"
				onclick={() => goto(`/profile/${userId}`)}
			>
				{#key avatar}
					<Avatar src={avatar ?? '/images/user.png'} alt={username} size="sm"></Avatar>
				{/key}
				<h2>{username}</h2>
			</div>
		</div>
		<hr class="rounded-xl border-1 border-gray-200" />
		<div class="flex h-1/2 w-full flex-col gap-2 overflow-y-auto">
			<div class="flex w-full items-start justify-start gap-2">
				{#key avatar}
					<Avatar src={avatar ?? '/images/user.png'} alt={username} size="sm"></Avatar>
				{/key}
				<div class="self-center">
					<p class="inline font-bold">{username}</p>
					<p class="ml-1 inline">{text}</p>
					<p class="mt-1 text-black/60">
						{new Date(time).toLocaleDateString()}
					</p>
				</div>
			</div>
			{#if comments}
				{#each comments as comment (comment.id)}
					<div class="flex w-full items-start justify-start gap-2">
						{#key comment.author.avatarUrl}
							<Avatar
								src={comment.author.avatarUrl ?? '/images/user.png'}
								alt={comment.author.handle}
								size="sm"
							></Avatar>
						{/key}
						<div class="self-center">
							<p class="inline font-bold">{comment.author.name}</p>
							<p class="ml-1 inline">{comment.text}</p>
							<p class="mt-1 text-black/60">
								{new Date(comment.createdAt).toLocaleDateString()}
							</p>
						</div>
					</div>
				{/each}
			{/if}
		</div>
		<hr class="rounded-xl border-1 border-gray-200" />
		<div class="flex w-full flex-col justify-between gap-3">
			<div class="flex gap-4">
				<button
					class="cursor-pointer rounded-2xl bg-gray-100 px-4 py-3 hover:bg-gray-200"
					onclick={callback.like}
				>
					<Like
						size="24px"
						color="var(--color-red-500"
						fill={isLiked ? 'var(--color-red-500)' : 'white'}
					/>
				</button>
				<button class="cursor-pointer rounded-2xl bg-gray-100 px-4 py-3 hover:bg-gray-200">
					<CommentIcon size="24px" color="black" fill="transparent" />
				</button>
			</div>
			<p class="text-black/60">
				{new Date(time).toLocaleDateString()}
			</p>
			<MessageInput
				variant="comment"
				src={ownerProfile?.avatarUrl ?? '/images/user.png'}
				bind:value={commentValue}
				{handleSend}
			/>
		</div>
	</div>
</article>
