<script lang="ts">
	import { goto } from '$app/navigation';
	import { Message } from '$lib/fragments';
	import { onMount } from 'svelte';
	import { apiClient } from '$lib/utils/axios';

	let messages = $state([]);

	onMount(async () => {
		const { data } = await apiClient.get('/api/chats');
		const { data: userData } = await apiClient.get('/api/users');
		messages = data.chats.map((c) => {
			const members = c.users.filter((u) => u.id !== userData.id);
			const memberNames = members.map((m) => m.displayName ?? m.username ?? m.ename);
			const avatar = members.length > 1 ? '/images/group.png' : members[0].profilePictureUrl;
			return {
				id: c.id,
				avatar,
				username: memberNames.join(', '),
				unread: c.latestMessage?.isRead,
				text: c.latestMessage?.content ?? 'start a chat'
			};
		});
	});
</script>

<section>
	{#each messages as message}
		<Message
			class="mb-6"
			avatar={message.avatar}
			username={message.username}
			text={message.text}
			unread={!message.unread}
			callback={() => goto(`/messages/${message.id}`)}
		/>
	{/each}
</section>
