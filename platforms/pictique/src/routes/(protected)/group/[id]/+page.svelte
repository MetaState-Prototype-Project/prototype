<script lang="ts">
	import { onMount } from 'svelte';
	import { ChatMessage, MessageInput } from '$lib/fragments';
	import { Avatar, Button } from '$lib/ui';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let messagesContainer: HTMLDivElement;
	let messageValue = $state('');

	let userId = 'user-1';
	let id = page.params.id;

	let group = {
		id: 'group-123',
		name: 'Design Team',
		avatar: 'https://i.pravatar.cc/150?img=15',
		description: 'Discuss all design-related tasks and updates here.',
		members: [
			{ id: 'user-1', name: 'Alice', avatar: 'https://i.pravatar.cc/150?img=1', role: 'owner' },
			{ id: 'user-2', name: 'Bob', avatar: 'https://i.pravatar.cc/150?img=2', role: 'admin' },
			{ id: 'user-3', name: 'Charlie', avatar: 'https://i.pravatar.cc/150?img=3', role: 'member' }
		]
	};

	let messages = $state([
		{
			id: 'msg-1',
			isOwn: false,
			userImgSrc: 'https://i.pravatar.cc/150?img=2',
			time: '2 minutes ago',
			message: 'Hey everyone, can we finalize the color palette today?'
		},
		{
			id: 'msg-2',
			isOwn: true,
			userImgSrc: 'https://i.pravatar.cc/150?img=1',
			time: '1 minute ago',
			message: 'Yes, I just pushed a new draft to Figma.'
		}
	]);

	let openMenuId = $state<string | null>(null);

	function scrollToBottom() {
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}

	onMount(() => {
		setTimeout(scrollToBottom, 0);
	});

	function handleSend() {
		if (!messageValue.trim()) return;
		messages = [
			...messages,
			{
				id: `msg-${Date.now()}`,
				isOwn: true,
				userImgSrc: group.members.find((m) => m.id === userId)?.avatar || '',
				time: 'just now',
				message: messageValue
			}
		];
		messageValue = '';
		setTimeout(scrollToBottom, 0);
	}
</script>

<section class="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-200">
	<div class="flex items-center gap-4">
		<Avatar src={group.avatar} />
		<div>
			<h1 class="text-lg font-semibold">{group.name}</h1>
			<p class="text-sm text-gray-600">{group.description}</p>
		</div>
	</div>
	<Button
		variant="secondary"
		size="sm"
		class="w-[max-content]"
		callback={() => {
			goto(`/group/${id}/members`)
		}}
	>
		View Members
	</Button>
</section>

<section class="chat relative px-0">
	<div class="h-[calc(100vh-300px)] mt-4 overflow-auto" bind:this={messagesContainer}>
		{#each messages as msg (msg.id)}
			<ChatMessage
				isOwn={msg.isOwn}
				userImgSrc={msg.userImgSrc}
				time={msg.time}
				message={msg.message}
			/>
		{/each}
	</div>

	<MessageInput
		class="sticky start-0 bottom-[-15px] w-full"
		variant="dm"
		src={group.avatar}
		bind:value={messageValue}
		{handleSend}
	/>
</section>
