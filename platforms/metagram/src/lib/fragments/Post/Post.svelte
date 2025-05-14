<script lang="ts">
	import { Avatar } from '$lib/ui';
	import { cn } from '$lib/utils';
	import {
		Message02Icon,
		MoreVerticalIcon,
		RecordIcon,
		ThumbsUpIcon
	} from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface IPostProps extends HTMLAttributes<HTMLElement> {
		avatar: string;
		username: string;
		imgUri: string;
		postAlt?: string;
		text: string;
		count: {
			likes: number;
			comments: number;
		};
		callback: {
			menu: () => void;
			like: () => void;
			comment: () => void;
		};
		time: string;
	}

	const {
		avatar,
		username,
		imgUri,
		text,
		postAlt,
		count,
		callback,
		time,
		...restProps
	}: IPostProps = $props();
</script>

<article {...restProps} class={cn(['flex w-full flex-col gap-4', restProps.class])}>
	<div class="flex w-full items-center justify-between">
		<div class="flex items-center justify-between gap-2">
			<Avatar src={avatar} alt={username} size="sm"></Avatar>
			<h2>{username}</h2>
		</div>

		<button onclick={callback.menu} class="cursor-pointer rounded-full p-2 hover:bg-gray-100">
			<HugeiconsIcon icon={MoreVerticalIcon} size={24} color="var(--color-black-500)" />
		</button>
	</div>
	<img src={imgUri} alt={postAlt ?? text} class="rounded-4xl" />
	<p class="text-black/80">{text}</p>
	<p class="text-black/60">{time}</p>
	<div class="flex w-full items-center justify-between">
		<div class="flex gap-4">
			<button
				class="cursor-pointer rounded-2xl bg-gray-100 px-4 py-3 hover:bg-gray-200"
				onclick={callback.like}
			>
				<HugeiconsIcon
					icon={ThumbsUpIcon}
					size={24}
					color="var(--color-red-500)"
					strokeWidth={3}
				/>
			</button>
			<button
				class="cursor-pointer rounded-2xl bg-gray-100 px-4 py-3 hover:bg-gray-200"
				onclick={callback.comment}
			>
				<HugeiconsIcon icon={Message02Icon} size={24} color="var(--color-black-500)" />
			</button>
		</div>
		<div class="flex items-center justify-between gap-3 text-lg text-black/40">
			<p>{count.likes} likes</p>
			<HugeiconsIcon
				icon={RecordIcon}
				size={5}
				strokeWidth={30}
				color="var(--color-black-400)"
				className="rounded-full"
			/>
			<p>{count.comments} comments</p>
		</div>
	</div>
</article>
