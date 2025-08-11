<script lang="ts">
	import { goto } from '$app/navigation';
	import { Message } from '$lib/fragments';
	import Group from '$lib/fragments/Group/Group.svelte';
	import { isSearching, searchError, searchResults, searchUsers } from '$lib/stores/users';
	import type { Chat, GroupInfo, MessageType } from '$lib/types';
	import { Avatar, Button, Input } from '$lib/ui';
	import { clickOutside } from '$lib/utils';
	import { apiClient } from '$lib/utils/axios';
	import { onMount } from 'svelte';
	import { heading } from '../../store';

	let messages = $state<MessageType[]>([]);
	let groups: GroupInfo[] = $state([]);
	let allMembers = $state<Record<string, string>[]>([]);
	let selectedMembers = $state<string[]>([]);
	let currentUserId = '';
	let openNewChatModal = $state(false);
	let searchValue = $state('');
	let debounceTimer: NodeJS.Timeout;

	async function loadMessages() {
		const { data } = await apiClient.get<{ chats: Chat[] }>('/api/chats');
		const { data: userData } = await apiClient.get('/api/users');
		currentUserId = userData.id;

		messages = data.chats.map((c) => {
			const members = c.participants.filter((u) => u.id !== userData.id);
			const memberNames = members.map((m) => m.name ?? m.handle ?? m.ename);
			const avatar =
				members.length > 1
					? 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/icons/people-fill.svg'
					: members[0].avatarUrl;
			return {
				id: c.id,
				avatar,
				username: c.handle ?? memberNames.join(', '),
				unread: c.latestMessage ? c.latestMessage.isRead : false,
				text: c.latestMessage?.text ?? 'No message yet',
				handle: c.handle ?? memberNames.join(', '),
				name: c.handle ?? memberNames.join(', ')
			};
		});
	}

	onMount(async () => {
		await loadMessages();

		const memberRes = await apiClient.get('/api/members');
		allMembers = memberRes.data;
	});

	function toggleMemberSelection(id: string) {
		if (selectedMembers.includes(id)) {
			selectedMembers = selectedMembers.filter((m) => m !== id);
		} else {
			selectedMembers = [...selectedMembers, id];
		}
	}

	function handleSearch(value: string) {
		searchValue = value;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			searchUsers(value);
		}, 300);
	}

	async function createChat() {
		if (selectedMembers.length === 0) return;

		try {
			if (selectedMembers.length === 1) {
				await apiClient.post('/api/chats/', {
					name: allMembers.find((m) => m.id === selectedMembers[0])?.name ?? 'New Chat',
					participantIds: [selectedMembers[0]]
				});
				await loadMessages(); // 🛠️ Refresh to include the new direct message
			} else {
				const groupMembers = allMembers.filter((m) => selectedMembers.includes(m.id));
				const groupName = groupMembers.map((m) => m.name ?? m.handle ?? m.ename).join(', ');
				groups = [
					...groups,
					{
						id: Math.random().toString(36).slice(2),
						name: groupName,
						avatar: '/images/group.png'
					}
				];
			}
		} catch (err) {
			console.error('Failed to create chat:', err);
		} finally {
			openNewChatModal = false;
			selectedMembers = [];
			searchValue = '';
		}
	}
</script>

<section class="px-4 py-4">
	<div class="mb-4 flex justify-end">
		<Button
			variant="secondary"
			size="sm"
			callback={() => {
				openNewChatModal = true;
			}}
		>
			New Chat
		</Button>
	</div>

	{#if messages.length > 0}
		{#each messages as message}
			<Message
				class="mb-2"
				avatar={message.avatar}
				username={message.name ?? message.username}
				text={message.text}
				unread={!message.unread}
				callback={() => {
					heading.set(message.username);
					goto(`/messages/${message.id}`);
				}}
			/>
		{/each}
	{/if}

	{#if groups.length > 0}
		<h3 class="text-md mt-6 mb-2 font-semibold text-gray-700">Groups</h3>
		{#each groups as group}
			<Group
				name={group.name || 'New Group'}
				avatar={group.avatar}
				unread={true}
				callback={() => goto(`/group/${group.id}`)}
			/>
		{/each}
	{:else if messages.length === 0}
		<div class="w-full px-5 py-5 text-center text-sm text-gray-500">
			You don't have any messages yet. Start a Direct Message by searching a name.
		</div>
	{/if}

	<dialog
		open={openNewChatModal}
		use:clickOutside={() => (openNewChatModal = false)}
		onclose={() => (openNewChatModal = false)}
		class="absolute start-[50%] top-[50%] z-50 w-[90vw] translate-x-[-50%] translate-y-[-50%] rounded-3xl border border-gray-400 bg-white p-4 shadow-xl md:max-w-[40vw]"
	>
		<div class="relative w-full space-y-6 rounded-xl bg-white p-6">
			<h2 class="text-xl font-semibold">Start a New Chat</h2>

			<Input
				type="text"
				bind:value={searchValue}
				placeholder="Search users..."
				oninput={(e: Event) => handleSearch((e.target as HTMLInputElement).value)}
			/>

			{#if $isSearching}
				<div class="mt-2 text-gray-500">Searching...</div>
			{:else if $searchError}
				<div class="mt-2 text-red-500">{$searchError}</div>
			{/if}

			<div class="max-h-[250px] space-y-3 overflow-y-auto">
				{#each $searchResults.filter((m) => m.id !== currentUserId) as member}
					<label class="flex cursor-pointer items-center space-x-3">
						<input
							type="checkbox"
							checked={selectedMembers.includes(member.id)}
							onchange={() => toggleMemberSelection(member.id)}
							class="accent-brand focus:ring"
						/>
						<Avatar src={member.avatarUrl} size="sm" />
						<span class="text-sm">{member.name ?? member.handle}</span>
					</label>
				{/each}
			</div>

			<div class="flex justify-end gap-2 pt-4">
				<Button
					size="sm"
					variant="secondary"
					callback={() => {
						openNewChatModal = false;
					}}>Cancel</Button
				>
				<Button size="sm" variant="primary" callback={createChat}>Start Chat</Button>
			</div>
		</div>
	</dialog>
</section>
