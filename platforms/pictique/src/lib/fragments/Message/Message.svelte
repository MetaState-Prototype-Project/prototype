<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import Avatar from '../../ui/Avatar/Avatar.svelte';
	import { cn } from '../../utils';

	interface IMessageProps extends HTMLAttributes<HTMLButtonElement> {
		avatar: string;
		handle: string;
		text: string;
		unread?: boolean;
		callback: () => void;
	}

	const {
		avatar,
		handle,
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
		'relative flex w-full cursor-pointer items-center gap-2 rounded-lg py-4',
		restProps.class
	])}
	onclick={callback}
>
	<Avatar src={avatar} alt="User Avatar" size="md" />
	<span class="flex w-full flex-col items-start justify-end gap-1">
		<span class="flex w-full items-center justify-between">
			<h2>{handle}</h2>
			{#if unread}
				<span class="h-2 w-2 rounded-full bg-blue-500"></span>
			{/if}
		</span>
		<p class="text-start text-black/60">{messageText}</p>
	</span>
</button>

<!--
@component
@name Message
@description A message component that displays a user's avatar, handle, and message text. It also includes an optional unread indicator.
@props
    - avatar: string - The URL of the user's avatar image.
    - handle: string - The name of the user.
    - text: string - The message text.
    - unread: boolean - Optional. Indicates if the message is unread. Defaults to false.
    - callback: () => void - Function to call when the message is clicked.
@usage
    <script>
        import { Message } from '$lib/ui';
    </script>

    <Message
        avatar="https://example.com/avatar.jpg"
        handle="John Doe"
        text="Hello, how are you?"
        unread={true}
        callback={() => console.log('Message clicked')}
    />
-->
