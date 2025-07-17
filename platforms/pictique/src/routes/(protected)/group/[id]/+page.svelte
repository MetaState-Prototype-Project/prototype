<script lang="ts">
	import { onMount } from 'svelte';
	import { ChatMessage, MessageInput } from '$lib/fragments';
	import { Avatar, Button } from '$lib/ui';
	import { clickOutside } from '$lib/utils';

	let messagesContainer: HTMLDivElement;
	let messageValue = $state('');
	let showMembers = $state(false);

	let userId = 'user-1';

	let group = {
		id: 'group-123',
		name: 'Design Team',
		avatar: 'https://i.pravatar.cc/150?img=15',
		description: 'Discuss all design-related tasks and updates here.',
		members: [
			{ id: 'user-1', name: 'Alice', avatar: 'https://i.pravatar.cc/150?img=1', role: 'owner' },
			{ id: 'user-2', name: 'Bob', avatar: 'https://i.pravatar.cc/150?img=2', role: 'admin' },
			{ id: 'user-3', name: 'Charlie', avatar: 'https://i.pravatar.cc/150?img=3', role: 'member' }
		]
	};

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

	let openMenuId = $state<string | null>(null);

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

	function currentUserRole() {
		return group.members.find((m) => m.id === userId)?.role;
	}

	function canManage(member: { id?: string; name?: string; avatar?: string; role: any; }) {
		const current = currentUserRole();
		if (member.role === 'owner') return false;
		if (current === 'owner') return true;
		if (current === 'admin' && member.role === 'member') return true;
		return false;
	}

	function promoteToAdmin(memberId: string) {
		const m = group.members.find((m) => m.id === memberId);
		if (m && m.role === 'member') m.role = 'admin';
		openMenuId = null;
	}

	function removeMember(memberId: string) {
		group.members = group.members.filter((m) => m.id !== memberId || m.role === 'owner');
		openMenuId = null;
	}

	function addMember() {
		const newId = `user-${Date.now()}`;
		group.members = [
			...group.members,
			{
				id: newId,
				name: `New Member ${group.members.length + 1}`,
				avatar: `https://i.pravatar.cc/150?u=${newId}`,
				role: 'member'
			}
		];
	}
</script>

<section class="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-200">
	<div class="flex items-center gap-4">
		<Avatar src={group.avatar} />
		<div>
			<h1 class="text-lg font-semibold">{group.name}</h1>
			<p class="text-sm text-gray-600">{group.description}</p>
		</div>
	</div>
	<Button
		variant="secondary"
		size="sm"
		class="w-[max-content]"
		callback={() => {
			showMembers = !showMembers;
			openMenuId = null;
		}}
	>
		{showMembers ? 'Hide Members' : 'View Members'}
	</Button>
</section>

{#if showMembers}
	<section class="px-4 py-3 border-b border-gray-200 space-y-4">
		{#each group.members as member (member.id)}
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<Avatar src={member.avatar} size="sm" />
					<div>
						<span class="text-sm font-medium">{member.name}</span>
						{#if member.role !== 'member'}
							<span class="ml-2 text-xs text-gray-500">({member.role})</span>
						{/if}
					</div>
				</div>

				{#if canManage(member)}
					<div class="relative" use:clickOutside={() => (openMenuId = null)}>
						<button
							onclick={() => {(openMenuId = openMenuId === member.id ? null : member.id)}}
						>
							⋮
						</button>

						{#if openMenuId === member.id}
							<div class="absolute right-0 mt-2 w-40 rounded-md bg-white shadow-lg border z-10">
								<ul class="text-sm">
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									{#if currentUserRole() === 'owner' && member.role === 'member'}
										<!-- svelte-ignore a11y_click_events_have_key_events -->
										<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
										<li
											class="px-4 py-2 hover:bg-gray-100 cursor-pointer"
											onclick={() => promoteToAdmin(member.id)}
										>
											Make admin
										</li>
									{/if}
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
									<li
										class="px-4 py-2 hover:bg-red-50 text-red-600 cursor-pointer"
										onclick={() => removeMember(member.id)}
									>
										Remove member
									</li>
								</ul>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/each}

		<Button size="sm" variant="primary" class="w-[max-content] mt-4" callback={addMember}>
			Add Member
		</Button>
	</section>
{/if}

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
