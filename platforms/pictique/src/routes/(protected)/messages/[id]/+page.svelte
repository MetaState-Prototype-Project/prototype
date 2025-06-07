<script lang="ts">
	import { MessageInput, ChatMessage } from '$lib/fragments';
	import { PUBLIC_PICTIQUE_BASE_URL } from '$env/static/public';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { getAuthToken, apiClient } from '$lib/utils/axios';
	import moment from 'moment';

	const id = page.params.id;
	let userId = $state();
	let messages: any[] = $state([]);
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

		eventSource.onopen = function (e) {
			console.log('Successfully connected.');
		};

		eventSource.onmessage = function (e) {
			const data = JSON.parse(e.data);
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
		const newMessages = arr.map((m) => ({
			id: m.id,
			isOwn: m.sender.id !== userId,
			userImgSrc: m.sender.avatarUrl,
			time: moment(m.createdAt).fromNow(),
			message: m.text
		}));
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
		src="https://picsum.photos/id/237/200/300"
		bind:value={messageValue}
		{handleSend}
	/>
</section>
