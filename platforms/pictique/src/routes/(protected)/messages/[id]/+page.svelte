<script lang="ts">
	import { page } from '$app/state';
	import { PUBLIC_PICTIQUE_BASE_URL } from '$env/static/public';
	import { ChatMessage, MessageInput } from '$lib/fragments';
	import { apiClient, getAuthToken } from '$lib/utils/axios';
	import moment from 'moment';
	import { onMount } from 'svelte';

	const id = page.params.id;
	let userId = $state();
	let messages: Record<string, unknown>[] = $state([]);
	let messageValue = $state('');
	let messagesContainer: HTMLDivElement;

	function scrollToBottom() {
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}

	// Scroll to bottom when messages change
	$effect(() => {
		if (messages) {
			// Use setTimeout to ensure DOM has updated
			setTimeout(scrollToBottom, 0);
		}
	});

	async function watchEventStream() {
		const sseUrl = new URL(
			`/api/chats/${id}/events?token=${getAuthToken()}`,
			PUBLIC_PICTIQUE_BASE_URL
		).toString();
		const eventSource = new EventSource(sseUrl);

		eventSource.onopen = () => {
			console.log('Successfully connected.');
		};

		eventSource.onmessage = (e) => {
			const data = JSON.parse(e.data);
			console.log('messages', data);
			addMessages(data);
			// Use setTimeout to ensure DOM has updated
			setTimeout(scrollToBottom, 0);
		};
	}

	async function handleSend() {
		await apiClient.post(`/api/chats/${id}/messages`, {
			text: messageValue
		});
		messageValue = '';
	}

	function addMessages(arr: Record<string, unknown>[]) {
		console.log(arr);
		const newMessages = arr.map((m) => {
			const sender = m.sender as Record<string, string>;
			return {
				id: m.id,
				isOwn: sender.id !== userId,
				userImgSrc: sender.avatarUrl,
				time: moment(m.createdAt as string).fromNow(),
				message: m.text
			};
		});
		apiClient.post(`/api/chats/${id}/messages/read`);

		messages = messages.concat(newMessages);
	}

	onMount(async () => {
		const { data: userData } = await apiClient.get('/api/users');
		userId = userData.id;
		watchEventStream();
	});
</script>

<section class="chat relative px-0">
	<div class="h-[calc(100vh-220px)] overflow-auto" bind:this={messagesContainer}>
		{#each messages as msg (msg.id)}
			<ChatMessage
				isOwn={msg.isOwns as boolean}
				userImgSrc={msg.userImgSrc as string}
				time={msg.time as string}
				message={msg.message as string}
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
