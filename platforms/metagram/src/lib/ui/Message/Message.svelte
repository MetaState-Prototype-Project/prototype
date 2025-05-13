<script lang="ts">
	import { Avatar } from '$lib/ui';
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	interface IMessageProps extends HTMLAttributes<HTMLButtonElement> {
		avatar: string;
		username: string;
		text: string;
		unread?: boolean;
		callback: () => void;
	}

	const {
		avatar,
		username,
		text,
		unread = false,
		callback,
		...restProps
	}: IMessageProps = $props();

	const messageText = $derived(text.length < 80 ? text : `${text.substring(0, 80)}...`);
</script>

<button
	{...restProps}
	class={cn([
		'relative flex w-full cursor-pointer items-center gap-2 rounded-lg py-4 hover:bg-gray-100',
		restProps.class
	])}
	onclick={callback}
>
	<Avatar src={avatar} alt="User Avatar" size="md" />
	<span class="flex w-full flex-col items-start justify-end gap-1">
		<span class="flex w-full items-center justify-between">
			<h2>{username}</h2>
			{#if unread}
				<span class="h-2 w-2 rounded-full bg-blue-500"></span>
			{/if}
		</span>
		<p class="text-black/60">{messageText}</p>
	</span>
</button>
