<script lang="ts">
	import { UserRequest } from '$lib/fragments';
	import { Input } from '$lib/ui';
	import {
		searchResults,
		isSearching,
		searchError,
		searchUsers,
		followUser
	} from '$lib/stores/users';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let searchValue = $state('');
	let debounceTimer: NodeJS.Timeout;

	function handleSearch(value: string) {
		searchValue = value;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			searchUsers(value);
		}, 300);
	}

	function handleProfileClick(userId: string) {
		goto(`/profile/${userId}`);
	}

	async function handleFollow(userId: string) {
		const success = await followUser(userId);
		if (success) {
			// Optionally refresh the search results to show updated follow status
			searchUsers(searchValue);
		}
	}

	onMount(() => {
		return () => {
			clearTimeout(debounceTimer);
		};
	});
</script>

<section class="w-full max-w-[500px]">
	<Input
		type="text"
		bind:value={searchValue}
		placeholder="Search users..."
		oninput={(e: Event) => handleSearch((e.target as HTMLInputElement).value)}
	/>

	{#if $isSearching}
		<div class="mt-6 text-center text-gray-500">Searching...</div>
	{:else if $searchError}
		<div class="mt-6 text-center text-red-500">{$searchError}</div>
	{:else if searchValue && $searchResults.length === 0}
		<div class="mt-6 text-center text-gray-500">No users found</div>
	{:else if searchValue}
		<ul class="mt-6 space-y-4 pb-4">
			{#each $searchResults as user}
				<li>
					<UserRequest
						userImgSrc={user.avatarUrl || 'https://picsum.photos/200'}
						userName={user.name || user.handle}
						description={user.description || ''}
						handleFollow={() => handleFollow(user.id)}
						onclick={() => handleProfileClick(user.id)}
					/>
				</li>
			{/each}
		</ul>
	{/if}
</section>
