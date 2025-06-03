<script lang="ts">
	import { goto } from '$app/navigation';
	import type { userProfile } from '$lib/types';
	import { Button } from '$lib/ui';
	import type { HTMLAttributes } from 'svelte/elements';

	interface IProfileProps extends HTMLAttributes<HTMLElement> {
		variant: 'user' | 'other';
		profileData: userProfile;
		onPostClick: (id: string) => void;
		onEditClick?: () => void;
		onFollowClick?: () => void;
		onMessageClick?: () => void;
	}

	const {
		variant = 'user',
		profileData,
		onPostClick,
		onEditClick,
		onFollowClick,
		onMessageClick,
		...restProps
	}: IProfileProps = $props();
</script>

<div {...restProps} class="bg-grey flex h-screen w-full flex-col items-center gap-4 px-3 pt-[10%]">
	<div class="flex flex-col items-center gap-4 p-4">
		<img class="size-28 rounded-full" src={profileData.avatar} alt="" />
		<div class="flex flex-col items-center gap-2">
			<p class="font-semibold">{profileData.userId}</p>
			<p class="text-black-600">{profileData.username}</p>
		</div>
		<div class="text-black-600 flex gap-4">
			<p><span class="font-semibold text-black">{profileData.followers}</span> followers</p>
			<p><span class="font-semibold text-black">{profileData.following}</span> following</p>
			<p><span class="font-semibold text-black">{profileData.totalPosts}</span> posts</p>
		</div>
		<div class="text-black-600 text-center text-sm md:px-12">
			{profileData.userBio}
		</div>
		<div class="flex w-full gap-3">
			{#if variant === 'user'}
				<div class="flex w-full justify-around">
					<Button size="sm" class="w-full md:w-[50%]" onclick={() => onEditClick()}>
						Edit Profile
					</Button>
				</div>
				<div class="w-full md:hidden">
					<Button size="sm" callback={() => goto(`/settings`)}>Settings</Button>
				</div>
			{:else if variant === 'other'}
				<div class="flex w-full justify-around">
					<Button size="sm" class="w-full md:w-[50%]" onclick={() => onFollowClick()}>
						Follow
					</Button>
				</div>
				<div class="w-full md:hidden">
					<Button size="sm" callback={() => onMessageClick()}>Message</Button>
				</div>
			{/if}
		</div>
	</div>
	<div class="grid grid-cols-3 gap-[2px]">
		{#each profileData.posts as post}
			<button onclick={() => onPostClick(post.id)}>
				<img
					class="aspect-square rounded-md object-cover"
					src={post.imgUri}
					alt="user post"
				/>
			</button>
		{/each}
	</div>
</div>
