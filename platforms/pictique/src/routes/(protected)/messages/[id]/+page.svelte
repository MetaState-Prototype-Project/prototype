<script lang="ts">
	import { page } from '$app/state';
	import { PUBLIC_PICTIQUE_BASE_URL } from '$env/static/public';
	import { apiClient, getAuthToken } from '$lib/utils/axios';
	import moment from 'moment';
	import { onMount } from 'svelte';

	const id = page.params.id;
	let userId = $state();
	let messages: Record<string, string | boolean | Date>[] = $state([]);
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

	// async function handleSend() {
	// 	await apiClient.post(`/api/chats/${id}/messages`, {
	// 		text: messageValue
	// 	});
	// 	messageValue = '';
	// }

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
