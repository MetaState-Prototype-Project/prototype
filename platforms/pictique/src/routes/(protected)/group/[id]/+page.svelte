<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ChatMessage, MessageInput } from '$lib/fragments';
	import Settings from '$lib/icons/Settings.svelte';
	import { Avatar, Button, Input, Label } from '$lib/ui';
	import { clickOutside } from '$lib/utils';
	import { Pen01FreeIcons } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { onMount } from 'svelte';

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
			{
				id: 'user-1',
				name: 'Alice',
				avatar: 'https://i.pravatar.cc/150?img=1',
				role: 'owner'
			},
			{ id: 'user-2', name: 'Bob', avatar: 'https://i.pravatar.cc/150?img=2', role: 'admin' },
			{
				id: 'user-3',
				name: 'Charlie',
				avatar: 'https://i.pravatar.cc/150?img=3',
				role: 'member'
			}
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

	async function handleSend() {
		if (!messageValue.trim()) return Promise.resolve();
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

	$effect(() => {
		if (groupImageFiles?.[0]) {
			const file = groupImageFiles[0];
			const reader = new FileReader();
			reader.onload = (e) => {
				if (e.target?.result) {
					groupImageDataUrl = e.target.result as string;
				}
			};
			reader.readAsDataURL(file);
		}
	});

	function saveGroupInfo() {
		group.name = groupName;
		group.description = groupDescription;
		group.avatar = groupImageDataUrl;
		openEditDialog = false;
	}

	const currentUser = group.members.find((m) => m.id === userId);
	const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'owner';
</script>

<section
	class="flex flex-col items-center justify-between gap-4 border-b border-gray-200 px-2 py-3 md:flex-row md:px-4"
>
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
			class="border-brand-burnt-orange-900 rounded-full border p-2"
		>
			<Settings size="24px" color="var(--color-brand-burnt-orange)" />
		</button>
	</div>
</section>

<section class="chat relative px-0">
	<div class="mt-4 h-[calc(100vh-300px)] overflow-auto" bind:this={messagesContainer}>
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

<dialog
	open={openEditDialog}
	use:clickOutside={() => (openEditDialog = false)}
	onclose={() => (openEditDialog = false)}
	class="absolute start-[50%] top-[50%] z-50 w-[90vw] translate-x-[-50%] translate-y-[-50%] rounded-3xl border border-gray-400 bg-white p-4 shadow-xl md:max-w-[30vw]"
>
	<div class="flex flex-col gap-6">
		<div class="relative h-[96px] w-[96px] self-center">
			<img
				src={groupImageDataUrl || '/images/avatar-placeholder.png'}
				alt="Group Avatar"
				class="h-full w-full rounded-full border border-gray-300 object-cover"
			/>
			{#if canEdit}
				<input
					type="file"
					accept="image/*"
					class="hidden"
					id="group-avatar-input"
					onchange={(e) => {
						const files = (e.target as HTMLInputElement).files;
						if (files && files[0]) {
							groupImageFiles = files;
						}
					}}
				/>
				<label
					for="group-avatar-input"
					class="bg-brand-burnt-orange border-brand-burnt-orange absolute right-0 bottom-0 cursor-pointer rounded-full border p-1 shadow"
				>
					<HugeiconsIcon icon={Pen01FreeIcons} color="white" />
				</label>
			{/if}
		</div>

		<div>
			<Label>Group Name</Label>
			{#if canEdit}
				<Input type="text" placeholder="Edit group name" bind:value={groupName} />
			{:else}
				<p class="text-gray-700">{group.name}</p>
			{/if}
		</div>

		<div>
			<Label>Description</Label>
			{#if canEdit}
				<!-- svelte-ignore element_invalid_self_closing_tag -->
				<textarea
					rows="2"
					maxlength="260"
					placeholder="Edit group description"
					class="bg-grey text-black-800 font-geist placeholder:text-black-600 invalid:border-red invalid:text-red focus:invalid:text-black-800 w-full rounded-4xl border border-transparent px-6 py-3.5 text-[15px] font-normal outline-0 focus:invalid:border-transparent"
					bind:value={groupDescription}
				/>
			{:else}
				<p class="text-gray-700">{group.description}</p>
			{/if}
		</div>

		<hr class="text-grey" />

		<div class="flex items-center gap-2">
			<Button
				size="sm"
				variant="primary"
				callback={() => {
					openEditDialog = false;
				}}>Cancel</Button
			>
			{#if canEdit}
				<Button size="sm" variant="secondary" callback={saveGroupInfo}>Save Changes</Button>
			{/if}
		</div>
	</div>
</dialog>
