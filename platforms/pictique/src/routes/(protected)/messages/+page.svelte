<script lang="ts">
	import { goto } from '$app/navigation';
	import { Message } from '$lib/fragments';
	import { isSearching, searchError, searchResults, searchUsers } from '$lib/stores/users';
	import type { Chat, MessageType } from '$lib/types';
	import { Avatar, Button, Input } from '$lib/ui';
	import { clickOutside } from '$lib/utils';
	import { apiClient } from '$lib/utils/axios';
	import { onMount } from 'svelte';
	import { heading } from '../../store';

	let messages = $state<MessageType[]>([]);
	let allMembers = $state<Record<string, string>[]>([]);
	let selectedMembers = $state<string[]>([]);
	let currentUserId = '';
	let openNewChatModal = $state(false);
	let searchValue = $state('');
	let debounceTimer: NodeJS.Timeout;

	async function loadMessages() {
		try {
			const { data } = await apiClient.get<{ chats: Chat[] }>('/api/chats');
			const { data: userData } = await apiClient.get('/api/users');
			currentUserId = userData.id;

			// Filter out group chats, only show direct messages
			messages = data.chats
				.filter((c) => c.participants.length === 2) // Only direct messages (2 participants: user + other person)
				.map((c) => {
					const members = c.participants.filter((u) => u.id !== userData.id);
					const memberNames = members.map((m) => m.name ?? m.handle ?? m.ename);
					const avatar =
						members[0]?.avatarUrl ||
						'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/icons/people-fill.svg';

					return {
						id: c.id,
						avatar,
						username: c.handle ?? memberNames.join(', '),
						unread: c.latestMessage ? !c.latestMessage.isRead : false,
						text: c.latestMessage?.text ?? 'No message yet',
						handle: c.handle ?? memberNames.join(', '),
						name: c.handle ?? memberNames.join(', ')
					};
				});
		} catch (error) {
			console.error('Failed to load messages:', error);
		}
	}

	onMount(async () => {
		try {
			await loadMessages();

			const memberRes = await apiClient.get('/api/members');
			allMembers = memberRes.data;
		} catch (error) {
			console.error('Failed to initialize messages page:', error);
		}
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
				// Create direct message
				await apiClient.post('/api/chats', {
					name: allMembers.find((m) => m.id === selectedMembers[0])?.name ?? 'New Chat',
					participantIds: [selectedMembers[0]]
				});
			} else {
				// Create group chat
				const groupMembers = allMembers.filter((m) => m.id === selectedMembers[0]);
				const groupName = groupMembers.map((m) => m.name ?? m.handle ?? m.ename).join(', ');

				// Create group chat via API
				await apiClient.post('/api/chats', {
					name: groupName,
					participantIds: selectedMembers,
					isGroup: true
				});
			}

			// Redirect to messages page with refresh
			window.location.href = '/messages';
		} catch (err) {
			console.error('Failed to create chat:', err);
			alert('Failed to create chat. Please try again.');
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

	{#if messages.length === 0}
		<div class="w-full px-5 py-5 text-center text-sm text-gray-500">
			You don't have any messages yet. Start a Direct Message by searching a name.
		</div>
	{/if}

	{#if openNewChatModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
			<div
				class="w-[90vw] max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-xl"
			>
				<div class="mb-6 flex items-center justify-between">
					<h2 class="text-xl font-semibold text-gray-900">Start a New Chat</h2>
					<button
						onclick={() => (openNewChatModal = false)}
						class="rounded-full p-2 hover:bg-gray-100"
					>
						<svg
							class="h-5 w-5 text-gray-500"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							></path>
						</svg>
					</button>
				</div>

				<div class="space-y-4">
					<Input
						type="text"
						bind:value={searchValue}
						placeholder="Search users..."
						oninput={(e: Event) => handleSearch((e.target as HTMLInputElement).value)}
					/>

					{#if $isSearching}
						<div class="text-center text-gray-500">Searching...</div>
					{:else if $searchError}
						<div class="text-center text-red-500">{$searchError}</div>
					{:else if $searchResults.length === 0 && searchValue.trim()}
						<div class="text-center text-gray-500">No users found</div>
					{/if}

					{#if $searchResults.length > 0}
						<div class="max-h-[250px] space-y-3 overflow-y-auto">
							{#each $searchResults.filter((m) => m.id !== currentUserId) as member}
								<label
									class="flex cursor-pointer items-center space-x-3 rounded-lg p-3 hover:bg-gray-50"
								>
									<input
										type="checkbox"
										checked={selectedMembers.includes(member.id)}
										onchange={(e: Event) => {
											toggleMemberSelection(member.id);
										}}
										class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
									/>
									<Avatar src={member.avatarUrl} size="sm" />
									<div class="flex flex-col">
										<span class="text-sm font-medium text-gray-900"
											>{member.name ?? member.handle}</span
										>
										{#if member.description}
											<span class="text-xs text-gray-500"
												>{member.description}</span
											>
										{/if}
									</div>
								</label>
							{/each}
						</div>
					{/if}

					{#if selectedMembers.length > 0}
						<div class="rounded-lg bg-blue-50 p-3">
							<p class="text-sm text-blue-800">
								{selectedMembers.length === 1
									? 'Direct message will be created'
									: `Group chat with ${selectedMembers.length} members will be created`}
							</p>
						</div>
					{/if}

					<div class="flex justify-end gap-3 pt-4">
						<Button
							size="sm"
							variant="secondary"
							callback={() => (openNewChatModal = false)}
						>
							Cancel
						</Button>
						<Button
							size="sm"
							variant="primary"
							callback={() => createChat()}
							disabled={selectedMembers.length === 0}
						>
							{selectedMembers.length === 1 ? 'Start Chat' : 'Create Group'}
						</Button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</section>
