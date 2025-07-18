<script lang="ts">
	import { onMount } from 'svelte';
	import { ChatMessage, MessageInput } from '$lib/fragments';
	import { Avatar, Button, Input, Label } from '$lib/ui';
	import { InputFile } from '$lib/fragments';
	import { Edit01FreeIcons } from '@hugeicons/core-free-icons';
	import {HugeiconsIcon} from "@hugeicons/svelte";
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Settings from '$lib/icons/Settings.svelte';
	import { clickOutside } from '$lib/utils';
	import VerticalDots from '$lib/icons/VerticalDots.svelte';

	let messagesContainer: HTMLDivElement;
	let messageValue = $state('');

	let userId = 'user-1';
	let id = page.params.id;

	let group = $state({
		id: 'group-123',
		name: 'Design Team',
		avatar: 'https://i.pravatar.cc/150?img=15',
		description: 'Discuss all design-related tasks and updates here.',
		members: [
			{ id: 'user-1', name: 'Alice', avatar: 'https://i.pravatar.cc/150?img=1', role: 'owner' },
			{ id: 'user-2', name: 'Bob', avatar: 'https://i.pravatar.cc/150?img=2', role: 'admin' },
			{ id: 'user-3', name: 'Charlie', avatar: 'https://i.pravatar.cc/150?img=3', role: 'member' }
		]
	});

	let messages = $state([
		{
			id: 'msg-1',
			isOwn: false,
			userImgSrc: 'https://i.pravatar.cc/150?img=2',
			time: '2 minutes ago',
			message: 'Hey everyone, can we finalize the color palette today?'
		},
		{
			id: 'msg-2',
			isOwn: true,
			userImgSrc: 'https://i.pravatar.cc/150?img=1',
			time: '1 minute ago',
			message: 'Yes, I just pushed a new draft to Figma.'
		}
	]);

	function scrollToBottom() {
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}

	onMount(() => {
		setTimeout(scrollToBottom, 0);
	});

	function handleSend() {
		if (!messageValue.trim()) return;
		messages = [
			...messages,
			{
				id: `msg-${Date.now()}`,
				isOwn: true,
				userImgSrc: group.members.find((m) => m.id === userId)?.avatar || '',
				time: 'just now',
				message: messageValue
			}
		];
		messageValue = '';
		setTimeout(scrollToBottom, 0);
	}

	let openEditDialog = $state(false);
	let groupName = $state(group.name);
	let groupDescription = $state(group.description);
	let groupImageDataUrl = $state(group.avatar);
	let groupImageFiles = $state<FileList | undefined>();

	function handleGroupImageChange() {
		if (groupImageFiles && groupImageFiles[0]) {
			const reader = new FileReader();
			reader.onload = (e) => {
				if (e.target?.result) {
					groupImageDataUrl = e.target.result as string;
				}
			};
			reader.readAsDataURL(groupImageFiles[0]);
		}
	}

	$effect(() => {
		if (groupImageFiles) handleGroupImageChange();
	});

	function saveGroupInfo() {
		group.name = groupName;
		group.description = groupDescription;
		group.avatar = groupImageDataUrl;
		openEditDialog = false;
	}
</script>

<section class="flex flex-col md:flex-row items-center justify-between gap-4 px-2 md:px-4 py-3 border-b border-gray-200">
	<div class="flex items-center gap-4">
		<Avatar src={group.avatar} />
		<div>
			<h1 class="text-lg font-semibold">{group.name}</h1>
			<p class="text-sm text-gray-600">{group.description}</p>
		</div>
	</div>
	<div class="flex items-center gap-2">
		<Button
			variant="secondary"
			size="sm"
			class="w-[max-content]"
			callback={() => {
				goto(`/group/${id}/members`);
			}}
		>
			View Members
		</Button>
		<button
			onclick={() => (openEditDialog = true)}
			class="border border-brand-burnt-orange-900 rounded-full p-2"
		>
			<Settings  size="24px" color="var(--color-brand-burnt-orange)" />
		</button>
	</div>
</section>

<section class="chat relative px-0">
	<div class="h-[calc(100vh-300px)] mt-4 overflow-auto" bind:this={messagesContainer}>
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
		src={group.avatar}
		bind:value={messageValue}
		{handleSend}
	/>
</section>

<dialog open={openEditDialog} use:clickOutside={() => openEditDialog = false} onclose={() => (openEditDialog = false)} class="w-full max-w-[300px] z-50 absolute start-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] p-2 border border-gray-100 rounded-4xl" >
	<div class="flex flex-col gap-6">
		<div>
			<InputFile
				bind:files={groupImageFiles}
				accept="image/*"
				label="Upload Group Avatar"
				cancelLabel="Remove"
				oncancel={() => {
					groupImageDataUrl = '';
					groupImageFiles = undefined;
				}}
			/>
			{#if groupImageDataUrl}
				<Avatar
				class="mt-4"
					src={groupImageDataUrl}
					alt="Group preview"
					size="lg"
				/>
			{/if}
		</div>

		<div>
			<Label>Group Name</Label>
			<Input type="text" placeholder="Edit group name" bind:value={groupName} />
		</div>

		<div>
			<Label>Description</Label>
			<Input type="text" placeholder="Edit group description" bind:value={groupDescription} />
		</div>

		<hr class="text-grey" />
		<Button size="sm" variant="secondary" callback={saveGroupInfo}>Save Changes</Button>
	</div>
</dialog>
