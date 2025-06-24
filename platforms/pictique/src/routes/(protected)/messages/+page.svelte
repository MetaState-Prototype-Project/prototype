<script lang="ts">
	import { goto } from '$app/navigation';
	import { Message } from '$lib/fragments';
	import { onMount } from 'svelte';
	import { apiClient } from '$lib/utils/axios';
	import { heading } from '../../store';
	import Button from '$lib/ui/Button/Button.svelte';

	let messages = $state([]);

	onMount(async () => {
		const { data } = await apiClient.get('/api/chats');
		const { data: userData } = await apiClient.get('/api/users');
		messages = data.chats.map((c) => {
			const members = c.participants.filter((u) => u.id !== userData.id);
			const memberNames = members.map((m) => m.name ?? m.handle ?? m.ename);
			const avatar = members.length > 1 ? '/images/group.png' : members[0].avatarUrl;
			return {
				id: c.id,
				avatar,
				username: memberNames.join(', '),
				unread: c.latestMessage ? c.latestMessage.isRead : false,
				text: c.latestMessage?.text ?? 'No message yet'
			};
		});
	});
</script>

<section>
	{#if messages}
	{#each messages as message}
		<Message
			class="mb-6"
			avatar={message.avatar}
			username={message.username}
			text={message.text}
			unread={!message.unread}
			callback={() => {
				heading.set(message.username);
				goto(`/messages/${message.id}`);
			}}
		/>
	{/each}
	{:else}
		<div class="h-[100vh] flex flex-col justify-center items-center gap-4">
			<h2 class="text-center">You have not started any conversations yet, find users and start a conversation with them.</h2>
			<Button class="w-[max-content]" variant="primary" size="sm" callback={async() => await goto('/discover')}>Search User</Button>
		</div>
	{/if}
</section>
