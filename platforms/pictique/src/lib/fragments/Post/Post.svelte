<script lang="ts">
	import { goto } from '$app/navigation';
	import { Like } from '$lib/icons';
	import CommentIcon from '$lib/icons/CommentIcon.svelte';
	import { Avatar } from '$lib/ui';
	import { cn } from '$lib/utils';
	import { ArrowLeftIcon, ArrowRightIcon, RecordIcon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface IPostProps extends HTMLAttributes<HTMLElement> {
		avatar: string;
		handle: string;
		userId?: string;
		imgUris: string[];
		text: string;
		isLiked?: boolean;
		count?: {
			likes: number;
			comments: number;
		};
		callback: {
			menu: () => void;
			like: () => void;
			comment: () => void;
		};
		time: string;
		options?: Array<{ name: string; handler: () => void }>;
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
		handle,
		imgUris: uris,
		text,
		count,
		callback,
		time,
		isLiked,
		...restProps
	}: IPostProps = $props();

	let imgUris = $derived(pairAndJoinChunks(uris));
	let galleryRef: HTMLDivElement | undefined = $state();
	let currentIndex = $state(0);

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
</script>

<article {...restProps} class={cn(['flex w-full flex-col gap-4', restProps.class])}>
	{#if count}
		<div class="flex w-full items-center justify-between">
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="flex items-center justify-between gap-2"
				onclick={() => goto(`/profile/${userId}`)}
			>
				<Avatar src={avatar ?? '/images/user.png'} alt={handle} size="sm"></Avatar>
				<h2>{handle}</h2>
			</div>
		</div>
	{/if}
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
					<div class="aspect-[4/5] h-full w-full snap-center md:aspect-[16/9]">
						<img
							src={img}
							alt={text}
							class="h-full w-full rounded-4xl object-cover"
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
		<p class="text-black/80">{text}</p>
		<p class="text-black/60">{time}</p>
	{/if}
	<div class="flex w-full items-center justify-between">
		{#if count}
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
					onclick={callback.comment}
				>
					<CommentIcon size="24px" color="black" fill="transparent" />
				</button>
			</div>
		{/if}
		{#if count}
			<div class="flex items-center justify-between gap-3 text-lg text-black/40">
				<p class="subtext text-black-400">{count?.likes} likes</p>
				<HugeiconsIcon
					icon={RecordIcon}
					size={5}
					strokeWidth={30}
					color="var(--color-black-400)"
					className="rounded-full"
				/>
				<p class="subtext text-black-400">{count?.comments} comments</p>
			</div>
		{/if}
	</div>
</article>
