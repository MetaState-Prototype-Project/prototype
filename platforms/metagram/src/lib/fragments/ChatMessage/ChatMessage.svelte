<script lang="ts">
	import { Avatar } from '$lib/ui';
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	interface IChatMessageProps extends HTMLAttributes<HTMLElement> {
		userImgSrc: string;
		message: string;
		time: string;
		transactionType: 'incoming' | 'outgoing';
		isHeadNeeded?: boolean;
	}

	let {
		userImgSrc = 'https://picsum.photos/id/237/200/300',
		message = 'i was thinking maybe like 12th?',
		time = '12:55 AM',
		transactionType = 'incoming',
		isHeadNeeded = true,
		...restProps
	}: IChatMessageProps = $props();
</script>

<div
	{...restProps}
	class={cn(
		[
			`flex items-start gap-2 ${transactionType === 'incoming' ? 'flex-row-reverse' : 'flex'}`,
			restProps.class
		].join(' ')
	)}
>
	<div class="w-8 flex-shrink-0">
		{#if isHeadNeeded}
			<Avatar size="xs" src={userImgSrc} />
		{/if}
	</div>

	<div class={cn(`max-w-[50%] ${isHeadNeeded ? 'mt-4' : 'mt-0'}`)}>
		<div
			class={cn(
				`relative rounded-3xl px-4 py-2 ${transactionType === 'incoming' ? 'bg-brand-burnt-orange' : 'bg-grey'}`
			)}
		>
			{#if isHeadNeeded}
				<svg
					class={`absolute ${transactionType === 'outgoing' ? 'start-[-8px] top-[-2px]' : 'end-[-8px] top-[2px]'}`}
					width="22"
					height="17"
					viewBox="0 0 22 17"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M0 0C5.79116 4.95613 8.40437 9.60298 10 17L22 2C11 2.5 7.53377 0.634763 0 0Z"
						fill={transactionType === 'outgoing'
							? '#F5F5F5'
							: 'var(--color-brand-burnt-orange)'}
					/>
				</svg>
			{/if}

			<p class={cn(`${transactionType === 'incoming' ? 'text-white' : 'text-black-600'}`)}>
				{message}
			</p>
		</div>

		<p
			class={cn(
				`subtext text-black-400 mt-0.5 flex text-xs text-nowrap ${
					transactionType === 'incoming' ? 'justify-end' : 'justify-start'
				}`
			)}
		>
			{time}
		</p>
	</div>
</div>
