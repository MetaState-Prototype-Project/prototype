<script lang="ts">
	import { page } from '$app/state';
	import { PUBLIC_PICTIQUE_BASE_URL } from '$env/static/public';
	import { ChatMessage, MessageInput } from '$lib/fragments';
	import { apiClient, getAuthToken } from '$lib/utils/axios';
	import moment from 'moment';
	import { onMount, onDestroy, tick } from 'svelte';
	import { heading } from '../../../store';
	import type { Chat } from '$lib/types';

	const id = page.params.id;
	let userId = $state();
	let messages: Record<string, unknown>[] = $state([]);
	let messageValue = $state('');
	let messagesContainer: HTMLDivElement;
	let eventSourceRef: EventSource | null = null;
	let historyLoaded = $state(false);
	let hasMore = $state(true);
	let loadingOlder = $state(false);
	let oldestMessageId = $state<string | null>(null);
	let shouldScrollToBottom = $state(false);
	let readTimeout: ReturnType<typeof setTimeout> | null = null;

	function markMessagesRead() {
		if (readTimeout) clearTimeout(readTimeout);
		readTimeout = setTimeout(() => {
			apiClient.post(`/api/chats/${id}/messages/read`).catch((err: unknown) => {
				console.error('Failed to mark messages as read:', err);
			});
		}, 500);
	}

	// Function to remove duplicate messages by ID
	function removeDuplicateMessages(
		messagesArray: Record<string, unknown>[]
	): Record<string, unknown>[] {
		const seen = new Set<string>();
		return messagesArray.filter((msg) => {
			const id = msg.id as string;
			if (seen.has(id)) {
				return false;
			}
			seen.add(id);
			return true;
		});
	}

	function scrollToBottom() {
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}

	// Scroll to bottom only when new messages arrive (not when older messages are prepended)
	$effect(() => {
		if (shouldScrollToBottom) {
			setTimeout(scrollToBottom, 0);
			shouldScrollToBottom = false;
		}
	});

	// Transform raw API messages into display format
	function transformMessages(arr: Record<string, unknown>[]): Record<string, unknown>[] {
		return arr.map((m) => {
			const isSystemMessage =
				!m.sender || m.text?.toString().startsWith('$$system-message$$');

			if (isSystemMessage) {
				return {
					id: m.id,
					isOwn: false,
					userImgSrc: '/images/system-message.png',
					time: moment(m.createdAt as string).fromNow(),
					message: m.text,
					isSystemMessage: true
				};
			}

			const sender = m.sender as Record<string, string>;
			const isOwn = sender.id !== userId;

			return {
				id: m.id,
				isOwn: isOwn,
				userImgSrc: sender.avatarUrl,
				time: moment(m.createdAt as string).fromNow(),
				message: m.text,
				isSystemMessage: false,
				senderId: sender.id,
				senderName: sender.name,
				senderHandle: sender.handle
			};
		});
	}

	// Compute head/timestamp flags for the full messages array
	function computeGroupFlags(
		messagesArray: Record<string, unknown>[]
	): Record<string, unknown>[] {
		return messagesArray.map((msg, index) => {
			const prevMessage = index > 0 ? messagesArray[index - 1] : null;
			const nextMessage = index < messagesArray.length - 1 ? messagesArray[index + 1] : null;

			const isHeadNeeded =
				!prevMessage ||
				prevMessage.isOwn !== msg.isOwn ||
				(prevMessage.senderId && msg.senderId && prevMessage.senderId !== msg.senderId);

			const isTimestampNeeded =
				!nextMessage ||
				nextMessage.isOwn !== msg.isOwn ||
				(nextMessage.senderId && msg.senderId && nextMessage.senderId !== msg.senderId);

			return {
				...msg,
				isHeadNeeded,
				isTimestampNeeded
			};
		});
	}

	async function watchEventStream() {
		const sseUrl = new URL(
			`/api/chats/${id}/events?token=${getAuthToken()}`,
			PUBLIC_PICTIQUE_BASE_URL
		).toString();
		const eventSource = new EventSource(sseUrl);
		eventSourceRef = eventSource;

		eventSource.onopen = () => {
			console.log('Successfully connected.');
		};

		eventSource.onmessage = (e) => {
			try {
				const data = JSON.parse(e.data);

				// Handle initial payload with metadata vs real-time new messages
				if (data.type === 'initial') {
					// Initial batch from SSE connection
					const transformed = transformMessages(data.messages);
					messages = computeGroupFlags(removeDuplicateMessages(transformed));
					hasMore = data.hasMore;
					if (data.messages.length > 0) {
						oldestMessageId = data.messages[0].id;
					}
					historyLoaded = true;
					shouldScrollToBottom = true;
				} else {
					// Real-time new message(s) — could be array or wrapped
					const rawMessages = Array.isArray(data) ? data : [data];
					const transformed = transformMessages(rawMessages);

					const existingIds = new Set(messages.map((msg) => msg.id));
					const uniqueNew = transformed.filter((msg) => !existingIds.has(msg.id));

					if (uniqueNew.length > 0) {
						const merged = removeDuplicateMessages([...messages, ...uniqueNew]);
						messages = computeGroupFlags(merged);
						shouldScrollToBottom = true;
					}
				}

				markMessagesRead();
			} catch (error) {
				console.error('Error parsing SSE message:', error);
			}
		};
	}

	async function handleSend() {
		await apiClient.post(`/api/chats/${id}/messages`, {
			text: messageValue
		});
		messageValue = '';
	}

	async function loadOlderMessages() {
		if (!oldestMessageId || loadingOlder || !hasMore) return;
		loadingOlder = true;

		const savedScrollHeight = messagesContainer.scrollHeight;
		const savedScrollTop = messagesContainer.scrollTop;

		try {
			const { data } = await apiClient.get(
				`/api/chats/${id}/messages/before?before=${oldestMessageId}&limit=30`
			);

			if (data.messages.length > 0) {
				const transformed = transformMessages(data.messages);
				const merged = removeDuplicateMessages([...transformed, ...messages]);
				messages = computeGroupFlags(merged);
				oldestMessageId = data.messages[0].id;

				// Restore scroll position after DOM update
				await tick();
				messagesContainer.scrollTop =
					messagesContainer.scrollHeight - savedScrollHeight + savedScrollTop;
			}

			hasMore = data.hasMore;
		} catch (error) {
			console.error('Failed to load older messages:', error);
		}

		loadingOlder = false;
	}

	function handleScroll() {
		if (messagesContainer.scrollTop < 100 && hasMore && !loadingOlder) {
			loadOlderMessages();
		}
	}

	async function loadChatInfo() {
		try {
			const { data: chatsData } = await apiClient.get<{
				chats: Chat[];
			}>(`/api/chats?page=1&limit=100`);

			const chat = chatsData.chats.find((c) => c.id === id);
			if (chat && userId) {
				const members = chat.participants.filter((u) => u.id !== userId);
				const isGroup = members.length > 1;

				const displayName = isGroup
					? chat.name || members.map((m) => m.name ?? m.handle ?? m.ename).join(', ')
					: members[0]?.name || members[0]?.handle || members[0]?.ename || 'Unknown User';

				heading.set(displayName);
			}
		} catch (error) {
			console.error('Failed to load chat info:', error);
		}
	}

	onMount(async () => {
		const { data: userData } = await apiClient.get('/api/users');
		userId = userData.id;
		await loadChatInfo();
		watchEventStream();
	});

	onDestroy(() => {
		if (eventSourceRef) {
			eventSourceRef.close();
			eventSourceRef = null;
		}
		if (readTimeout) {
			clearTimeout(readTimeout);
		}
	});
</script>

<section class="chat relative px-0">
	<div
		class="h-[calc(100vh-220px)] overflow-auto"
		bind:this={messagesContainer}
		onscroll={handleScroll}
	>
		{#if !historyLoaded}
			<div class="flex h-full items-center justify-center">
				<span class="loading loading-spinner loading-md text-gray-500"></span>
			</div>
		{:else}
			{#if loadingOlder}
				<div class="flex justify-center p-3">
					<span class="loading loading-spinner loading-sm text-gray-500"></span>
				</div>
			{/if}
			{#if !hasMore && messages.length > 0}
				<p class="m-4 text-center text-xs text-gray-400">No more messages</p>
			{/if}
			{#if messages.length === 0}
				<p class="m-4 text-center text-gray-500">
					No messages yet. Start the conversation!
				</p>
			{/if}
		{/if}
		{#each messages as msg (msg.id)}
			<ChatMessage
				isOwn={msg.isOwn as boolean}
				userImgSrc={msg.userImgSrc as string}
				time={msg.time as string}
				message={msg.message as string}
				isHeadNeeded={msg.isHeadNeeded as boolean}
				isTimestampNeeded={msg.isTimestampNeeded as boolean}
				sender={msg.isSystemMessage
					? null
					: {
							id: msg.senderId as string,
							name: msg.senderName as string,
							handle: msg.senderHandle as string,
							avatarUrl: msg.userImgSrc as string
						}}
			/>
		{/each}
	</div>
	<MessageInput
		class="sticky start-0 bottom-[-15px] w-full"
		variant="dm"
		src="https://picsum.photos/id/237/200/300"
		bind:value={messageValue}
		{handleSend}
	/>
</section>
