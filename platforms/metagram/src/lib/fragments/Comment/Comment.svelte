<script lang="ts">
	import { Like } from '$lib/icons';
	import { Avatar } from '$lib/ui';
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	interface ICommentProps extends HTMLAttributes<HTMLElement> {
		isLiked: boolean;
		isDisliked: boolean;
		imgSrc: string;
		name: string;
		comment: string;
		time: string;
		likeCount: number;
		handleReply: () => void;
	}

	let {
		isLiked = false,
		isDisliked = false,
		imgSrc = 'https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250',
		name,
		comment,
		time,
		likeCount = 0,
		handleReply,
		...restProps
	}: ICommentProps = $props();
</script>

<article {...restProps} class={cn([restProps.class].join(' '))}>
	<div class="align-start flex gap-2">
		<Avatar src={imgSrc} size="sm" />
		<div>
			<h3 class="font-semibold text-black">{name}</h3>
			<p class="text-black-600 mt-0.5">{comment}</p>
		</div>
	</div>
	<div class="ms-12 mt-2 flex items-center gap-2">
		<button
			onclick={() => {
				if (!isLiked) {
					likeCount++;
					isLiked = true;
					isDisliked = false;
				}
			}}
		>
			<Like
				size="18px"
				color={isLiked ? 'var(--color-brand-burnt-orange)' : 'var(--color-black-600)'}
				fill={isLiked ? 'var(--color-brand-burnt-orange)' : 'var(--color-black-600)'}
			/>
		</button>
		<p class="text-black-600 font-semibold">{likeCount}</p>
		<button
			onclick={() => {
				if (!isDisliked) {
					likeCount--;
					isDisliked = true;
					isLiked = false;
				}
			}}
		>
			<Like
				size="18px"
				color={isDisliked ? 'var(--color-brand-burnt-orange)' : 'var(--color-black-600)'}
				fill={isDisliked ? 'var(--color-brand-burnt-orange)' : 'var(--color-black-600)'}
				class="rotate-180"
			/>
		</button>
		<span class="bg-black-600 inline-block h-1 w-1 rounded-full"></span>
		<button onclick={handleReply} class="text-black-600 font-semibold">Reply</button>
		<span class="bg-black-600 inline-block h-1 w-1 rounded-full"></span>
		<p class="text-black-600">{time}</p>
	</div>
</article>
