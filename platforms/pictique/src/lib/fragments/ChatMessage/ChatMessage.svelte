<script lang="ts">
	import { Avatar } from '$lib/ui';
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	interface IChatMessageProps extends HTMLAttributes<HTMLElement> {
		userImgSrc?: string;
		message: string;
		time: string;
		isOwn: boolean;
		isHeadNeeded?: boolean;
		isTimestampNeeded?: boolean;
		sender?: {
			id: string;
			name: string;
			handle: string;
			avatarUrl: string;
		} | null;
	}

	let {
		userImgSrc = 'https://picsum.photos/id/237/200/300',
		message = 'i was thinking maybe like 12th?',
		time = '12:55 AM',
		isOwn,
		isHeadNeeded = true,
		isTimestampNeeded = true,
		sender = null,
		...restProps
	}: IChatMessageProps = $props();

	// Check if this is a system message
	const isSystemMessage = $derived(!sender && message.startsWith('$$system-message$$'));
	// Remove the prefix for display
	const displayText = $derived(
		isSystemMessage ? message.replace('$$system-message$$', '').trim() : message
	);
</script>

{#if isSystemMessage}
	<!-- System Message - Centered with special styling -->
	<div {...restProps} class={cn('my-4 flex items-center justify-center', restProps.class)}>
		<div class="max-w-[80%] text-center">
			<div class="inline-block rounded-[10px] border border-gray-300 bg-gray-200 px-4 py-2">
				<div class="whitespace-pre-wrap text-left text-sm font-medium text-black">
					{@html displayText.replace(
						/<a href="([^"]+)">([^<]+)<\/a>/g,
						'<a href="$1" class="text-blue-600 hover:text-blue-800 underline">$2</a>'
					)}
				</div>
			</div>
			{#if isTimestampNeeded}
				<p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
					{time}
				</p>
			{/if}
		</div>
	</div>
{:else}
	<!-- Regular User Message -->
	<div
		{...restProps}
		class={cn(
			[
				`flex items-start gap-2 ${isOwn ? 'flex' : 'flex-row-reverse'} mb-1`,
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
					`relative rounded-3xl px-4 py-2 ${isOwn ? 'bg-grey' : 'bg-brand-burnt-orange'}`
				)}
			>
				{#if isHeadNeeded}
					<svg
						class={`absolute ${isOwn ? 'start-[-5px] top-[-2px]' : 'end-[-5px] top-[2px]'}`}
						width="22"
						height="17"
						viewBox="0 0 22 17"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M0 0C5.79116 4.95613 8.40437 9.60298 10 17L22 2C11 2.5 7.53377 0.634763 0 0Z"
							fill={isOwn ? '#F5F5F5' : 'var(--color-brand-burnt-orange)'}
						/>
					</svg>
				{/if}

				<div class={cn(`${!isOwn ? 'text-white' : 'text-black-600'} whitespace-pre-wrap`)}>
					{@html displayText.replace(
						/<a href="([^"]+)">([^<]+)<\/a>/g,
						'<a href="$1" class="text-blue-600 hover:text-blue-800 underline">$2</a>'
					)}
				</div>
			</div>

			{#if isTimestampNeeded}
				<p
					class={cn(
						`subtext text-black-400 mt-0.5 flex text-nowrap text-xs ${
							isOwn ? 'justify-end' : 'justify-start'
						}`
					)}
				>
					{time}
				</p>
			{/if}
		</div>
	</div>
{/if}
