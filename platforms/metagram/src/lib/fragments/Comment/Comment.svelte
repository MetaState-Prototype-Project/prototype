<script lang="ts">
	import { Like } from '$lib/icons';
	import { Avatar } from '$lib/ui';
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';
	import CommentComponent from './Comment.svelte';
	import type { CommentType } from '$lib/types';

	interface ICommentProps extends HTMLAttributes<HTMLElement> {
		comment: CommentType;
		handleReply: (id: string) => void;
	}

	let visibleReplies = $state(2);

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
				if (!comment.isUpVoted) {
					comment.upVotes++;
					comment.isUpVoted = true;
					comment.isDownVoted = false;
				}
			}}
		>
			<Like
				size="18px"
				color={comment.isUpVoted
					? 'var(--color-brand-burnt-orange)'
					: 'var(--color-black-600)'}
				fill={comment.isUpVoted
					? 'var(--color-brand-burnt-orange)'
					: 'var(--color-black-600)'}
			/>
		</button>
		<p class="text-black-600 font-semibold">{comment.upVotes}</p>
		<button
			onclick={() => {
				if (!comment.isDownVoted) {
					comment.upVotes--;
					comment.isDownVoted = true;
					comment.isUpVoted = false;
				}
			}}
		>
			<Like
				size="18px"
				color={comment.isDownVoted
					? 'var(--color-brand-burnt-orange)'
					: 'var(--color-black-600)'}
				fill={comment.isDownVoted
					? 'var(--color-brand-burnt-orange)'
					: 'var(--color-black-600)'}
				class="rotate-180"
			/>
		</button>
		<span class="bg-black-600 inline-block h-1 w-1 rounded-full"></span>
		<button onclick={() => handleReply(comment.commentId)} class="text-black-600 font-semibold"
			>Reply</button
		>
		<span class="bg-black-600 inline-block h-1 w-1 rounded-full"></span>
		<p class="text-black-600">{comment.time}</p>
	</div>
	{#if comment?.replies?.length}
		<ul class="ms-12 mt-4 space-y-2">
			{#each comment.replies.slice(0, visibleReplies) as reply}
				<li>
					<CommentComponent comment={reply} {handleReply} />
				</li>
			{/each}
			{#if comment.replies.length > visibleReplies}
				<button
					onclick={showMoreReplies}
					class="text-brand-burnt-orange mt-1 text-sm font-medium"
				>
					See {comment.replies.length - visibleReplies} more replies
				</button>
			{/if}
		</ul>
	{/if}
</article>
