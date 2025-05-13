<script lang="ts">
	import { Avatar } from '$lib/ui';
	import { cn } from '$lib/utils';

	interface IMessageProps {
		avatar: string;
		username: string;
		text: string;
		unread?: boolean;
	}

	const { avatar, username, text, unread = false }: IMessageProps = $props();

	const classes = $derived({
		common: 'flex items-center gap-2 p-2 cursor-pointer rounded-lg hover:bg-gray-100'
	});

	const messageText = $derived(text.length < 80 ? text : `${text.substring(0, 80)}...`);
</script>

<article class={cn([classes.common])}>
	<Avatar src={avatar} alt="User Avatar" size="md" />
	<span class="flex flex-col items-start justify-end gap-1">
		<h2>{username}</h2>
		<p class="text-black/60">{messageText}</p>
	</span>
</article>
