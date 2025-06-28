<script lang="ts">
	import { goto } from '$app/navigation';
	import { Message } from '$lib/fragments';
	import { onMount } from 'svelte';
	import { apiClient } from '$lib/utils/axios';
	import { heading } from '../../store';

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
	{#if messages && messages.length > 0}
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
		<div class="w-full px-5 py-5 text-center">
			You don't have any messages yet, please start a Direct Message with Someone by searching
			their name
		</div>
	{/if}
</section>
