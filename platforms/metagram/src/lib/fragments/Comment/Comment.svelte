<script lang="ts">
	import { Like } from '$lib/icons';
	import { Avatar } from '$lib/ui';
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';
	import CommentComponent from './Comment.svelte';
	import type { CommentType } from '$lib/types';

	interface ICommentProps extends HTMLAttributes<HTMLElement> {
		comment: CommentType;
		handleReply: () => void;
	}

    let visibleReplies = 2;

    const showMoreReplies = () => {
        visibleReplies = comment.replies.length;
    };

	let { comment, handleReply, ...restProps }: ICommentProps = $props();
</script>

<article {...restProps} class={cn([restProps.class].join(' '))}>
	<div class="align-start flex gap-2">
		<Avatar src={comment.userImgSrc} size="sm" />
		<div>
			<h3 class="font-semibold text-black">{comment.name}</h3>
			<p class="text-black-600 mt-0.5">{comment.comment}</p>
		</div>
	</div>
	<div class="ms-12 mt-2 flex items-center gap-2">
		<button
			onclick={() => {
				if (!comment.isLiked) {
					comment.likeCount++;
					comment.isLiked = true;
					comment.isDisliked = false;
				}
			}}
		>
			<Like
				size="18px"
				color={comment.isLiked
					? 'var(--color-brand-burnt-orange)'
					: 'var(--color-black-600)'}
				fill={comment.isLiked
					? 'var(--color-brand-burnt-orange)'
					: 'var(--color-black-600)'}
			/>
		</button>
		<p class="text-black-600 font-semibold">{comment.likeCount}</p>
		<button
			onclick={() => {
				if (!comment.isDisliked) {
					comment.likeCount--;
					comment.isDisliked = true;
					comment.isLiked = false;
				}
			}}
		>
			<Like
				size="18px"
				color={comment.isDisliked
					? 'var(--color-brand-burnt-orange)'
					: 'var(--color-black-600)'}
				fill={comment.isDisliked
					? 'var(--color-brand-burnt-orange)'
					: 'var(--color-black-600)'}
				class="rotate-180"
			/>
		</button>
		<span class="bg-black-600 inline-block h-1 w-1 rounded-full"></span>
		<button onclick={handleReply} class="text-black-600 font-semibold">Reply</button>
		<span class="bg-black-600 inline-block h-1 w-1 rounded-full"></span>
		<p class="text-black-600">{comment.time}</p>
	</div>
	{#if comment?.replies?.length}
		<ul class="ms-12 mt-4 space-y-2">
			{#each comment.replies as reply}
				<li>
					<CommentComponent comment={reply} {handleReply} />
				</li>
			{/each}
		</ul>
	{/if}
</article>
