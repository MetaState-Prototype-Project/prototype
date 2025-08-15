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
	let selectedMembersData = $state<any[]>([]);
	let currentUserId = '';
	let profile = $state<any>(null);
	let openNewChatModal = $state(false);
	let openNewGroupModal = $state(false);
	let searchValue = $state('');
	let groupName = $state('');
	let debounceTimer: NodeJS.Timeout;

	async function loadMessages() {
		try {
			const { data } = await apiClient.get<{ chats: Chat[] }>('/api/chats');
			const { data: userData } = await apiClient.get('/api/users');
			currentUserId = userData.id;

			console.log('Raw chat data from API:', data.chats);

			// Show all chats (direct messages and groups) in one unified list
			messages = data.chats.map((c) => {
				const members = c.participants.filter((u) => u.id !== userData.id);
				const memberNames = members.map((m) => m.name ?? m.handle ?? m.ename);
				const isGroup = members.length > 1;

				// Use group avatar for groups, user avatar for direct messages
				const avatar = isGroup
					? '/images/group.png'
					: members[0]?.avatarUrl ||
						'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/icons/people-fill.svg';

				// For groups, prioritize the group name, fallback to member names
				// For direct messages, use the other person's name
				const displayName = isGroup
					? c.name || memberNames.join(', ') // Group name first, then member names
					: c.name || members[0]?.name || members[0]?.handle || 'Unknown User';

				return {
					id: c.id,
					avatar,
					username: displayName,
					unread: c.latestMessage ? !c.latestMessage.isRead : false,
					text: c.latestMessage?.text ?? 'No message yet',
					handle: displayName,
					name: displayName
				};
			});
		} catch (error) {
			console.error('Failed to load messages:', error);
		}
	}

	onMount(async () => {
		try {
			await loadMessages();

			// Get current user first
			const { data: userData } = await apiClient.get('/api/users');
			currentUserId = userData.id;
			profile = userData; // Set profile data

			// Load all members and pre-select current user
			const memberRes = await apiClient.get('/api/members');
			allMembers = memberRes.data;

			// Pre-select current user for group creation
			selectedMembers = [currentUserId];

			// Store current user in allMembers if not already there
			if (!allMembers.find((m) => m.id === currentUserId)) {
				allMembers.push({
					id: currentUserId,
					name: userData.name || userData.handle,
					handle: userData.handle,
					avatarUrl: userData.avatarUrl || '/images/default-avatar.png'
				});
			}

			// Initialize selectedMembersData with current user
			selectedMembersData = [
				{
					id: currentUserId,
					name: userData.name || userData.handle,
					handle: userData.handle,
					avatarUrl: userData.avatarUrl || '/images/default-avatar.png'
				}
			];
		} catch (error) {
			console.error('Failed to initialize messages page:', error);
		}
	});

	function toggleMemberSelection(id: string): void {
		if (selectedMembers.includes(id)) {
			// Remove from selected members
			selectedMembers = selectedMembers.filter((m) => m !== id);
			selectedMembersData = selectedMembersData.filter((m) => m.id !== id);
		} else {
			// Add to selected members
			selectedMembers = [...selectedMembers, id];

			// Find the member data from search results or allMembers
			const memberData =
				$searchResults.find((m) => m.id === id) || allMembers.find((m) => m.id === id);

			if (memberData) {
				selectedMembersData = [...selectedMembersData, memberData];
			}
		}
	}

	function handleSearch(value: string) {
		searchValue = value;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			// Only search if there's a value, otherwise clear results
			if (value.trim()) {
				searchUsers(value);
			} else {
				// Clear search results when input is empty, but keep selected members
				searchResults.set([]);
			}
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

			// Navigate to the new chat instead of hard refresh
			if (selectedMembers.length === 1) {
				// For direct messages, we need to find the chat ID
				// For now, redirect to messages and let the user click on the new chat
				goto('/messages');
			} else {
				// For group chats, redirect to messages
				goto('/messages');
			}
		} catch (err) {
			console.error('Failed to create chat:', err);
			alert('Failed to create chat. Please try again.');
		} finally {
			openNewChatModal = false;
			selectedMembers = [];
			searchValue = '';
		}
	}

	async function createGroup() {
		if (selectedMembers.length === 0 || !groupName.trim()) return;

		try {
			// Use the chats endpoint for group creation
			await apiClient.post('/api/chats', {
				name: groupName.trim(),
				participantIds: selectedMembers
			});

			// Close modal and reset form
			openNewGroupModal = false;
			groupName = '';
			selectedMembers = [];
			selectedMembersData = [];
			searchValue = '';

			// Navigate to messages and refresh the feed
			goto('/messages');
			// Refresh the messages to show the newly created group
			await loadMessages();
		} catch (err) {
			console.error('Failed to create group:', err);
			alert('Failed to create group. Please try again.');
		}
	}
</script>

<section class="px-4 py-4">
	<div class="mb-4 flex justify-end">
		<Button
			variant="secondary"
			size="sm"
			callback={() => {
				openNewGroupModal = true;
			}}
		>
			New Group
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
											return;
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

	<!-- New Group Modal -->
	{#if openNewGroupModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
			<div
				class="w-[90vw] max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-xl"
			>
				<div class="mb-6 flex items-center justify-between">
					<h2 class="text-xl font-semibold text-gray-900">Create New Group</h2>
					<button
						onclick={() => (openNewGroupModal = false)}
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
					<!-- Group Name -->
					<div>
						<label for="groupName" class="mb-2 block text-sm font-medium text-gray-700">
							Group Name *
						</label>
						<Input
							id="groupName"
							type="text"
							bind:value={groupName}
							placeholder="Enter group name..."
							class="w-full"
						/>
					</div>

					<!-- Member Search -->
					<div>
						<label class="mb-2 block text-sm font-medium text-gray-700">
							Search Users by Name
						</label>
						<Input
							type="text"
							bind:value={searchValue}
							placeholder="Type a name to search..."
							oninput={(e: Event) =>
								handleSearch((e.target as HTMLInputElement).value)}
							class="w-full"
						/>
					</div>

					<!-- Search Results -->
					{#if $isSearching}
						<div class="py-2 text-center text-gray-500">Searching...</div>
					{:else if $searchError}
						<div class="py-2 text-center text-red-500">{$searchError}</div>
					{:else if $searchResults.length > 0}
						<div class="mb-2 flex items-center justify-between">
							<h4 class="text-sm font-medium text-gray-700">Available Users</h4>
							<span class="text-xs text-gray-500"
								>{selectedMembers.length} member{selectedMembers.length !== 1
									? 's'
									: ''} selected</span
							>
						</div>
						<div class="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3">
							{#each $searchResults.filter((m) => m.id !== currentUserId) as member}
								<label
									class="flex cursor-pointer items-center space-x-3 rounded-lg p-2 hover:bg-gray-50"
								>
									<input
										type="checkbox"
										checked={selectedMembers.includes(member.id)}
										onchange={(e: Event) => {
											toggleMemberSelection(member.id);
											return;
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

					<!-- Selected Members Display -->
					{#if selectedMembersData.length > 0}
						<div class="rounded-lg border p-3">
							<h4 class="mb-2 text-sm font-medium text-gray-700">
								Selected Members:
							</h4>
							<div class="flex flex-wrap gap-2">
								{#each selectedMembersData as member}
									<div
										class="flex items-center space-x-2 rounded-full bg-blue-50 px-3 py-1"
									>
										<Avatar src={member.avatarUrl} size="xs" />
										<span class="text-sm text-blue-800"
											>{member.name ?? member.handle}</span
										>
										<button
											onclick={() => toggleMemberSelection(member.id)}
											class="text-blue-600 hover:text-blue-800"
										>
											<svg
												class="h-4 w-4"
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
								{/each}
							</div>
						</div>
					{/if}

					<!-- Action Buttons -->
					<div class="flex justify-end gap-3 pt-4">
						<Button
							size="sm"
							variant="secondary"
							callback={() => (openNewGroupModal = false)}
						>
							Cancel
						</Button>
						<Button
							size="sm"
							variant="primary"
							callback={() => createGroup()}
							disabled={selectedMembers.length === 0 || !groupName.trim()}
						>
							Create Group
						</Button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</section>
