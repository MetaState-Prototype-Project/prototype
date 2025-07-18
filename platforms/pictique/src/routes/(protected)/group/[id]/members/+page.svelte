<script lang="ts">
	import { page } from '$app/state';
	import { Avatar, Button } from '$lib/ui';
	import { clickOutside } from '$lib/utils';

	let groupId = page.params.id;

	let userId = 'user-1'; 

	let group = $state({
		id: groupId,
		name: 'Design Team',
		avatar: 'https://i.pravatar.cc/150?img=15',
		description: 'Discuss all design-related tasks and updates here.',
		members: [
			{ id: 'user-1', name: 'Alice', avatar: 'https://i.pravatar.cc/150?img=1', role: 'owner' },
			{ id: 'user-2', name: 'Bob', avatar: 'https://i.pravatar.cc/150?img=2', role: 'admin' },
			{ id: 'user-3', name: 'Charlie', avatar: 'https://i.pravatar.cc/150?img=3', role: 'member' }
		]
	});

	let openMenuId = $state<string | null>(null);

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

<section class="mx-auto w-full h-[80vh] flex flex-col justify-between">
	<div>
	<div class="flex items-center gap-4 mb-6">
		<Avatar src={group.avatar} />
		<div>
			<h1 class="text-xl font-semibold">{group.name}</h1>
			<p class="text-sm text-gray-600">{group.description}</p>
		</div>
	</div>

	<div class="space-y-6">
		{#each group.members as member (member.id)}
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<Avatar src={member.avatar} size="sm" />
					<div>
						<p class="text-sm font-medium">{member.name}</p>
						{#if member.role !== 'member'}
							<p class="text-xs text-gray-500">{member.role}</p>
						{/if}
					</div>
				</div>

				{#if canManage(member)}
					<div class="relative" use:clickOutside={() => (openMenuId = null)}>
						<button
							onclick={() => (openMenuId = openMenuId === member.id ? null : member.id)}
						>
							⋮
						</button>

						{#if openMenuId === member.id}
							<div class="absolute right-0 mt-2 w-40 rounded-md bg-white shadow-lg border z-10">
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<ul class="text-sm">
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
	</div>
	</div>

	<div class="flex justify-center">
		<Button size="sm" variant="secondary" class="mt-6" callback={addMember}>
			Add Member
		</Button>
	</div>
</section>
