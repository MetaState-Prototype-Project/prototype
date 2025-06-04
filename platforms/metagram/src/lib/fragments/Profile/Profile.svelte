<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PostData, userProfile } from '$lib/types';
	import { Button } from '$lib/ui';
	import type { HTMLAttributes } from 'svelte/elements';

	interface IProfileProps extends HTMLAttributes<HTMLElement> {
		variant: 'user' | 'other';
		profileData: userProfile;
		handleEdit?: () => Promise<void>;
		handleFollow?: () => Promise<void>;
		handleMessage?: () => Promise<void>;
		handleSinglePost?: (post: PostData) => void;
	}

	const {
		variant = 'user',
		profileData,
		handleEdit,
		handleFollow,
		handleMessage,
		handleSinglePost,
		...restProps
	}: IProfileProps = $props();
</script>

<div {...restProps} class="flex h-screen w-full flex-col items-center gap-4">
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
					<Button size="sm" class="w-full md:w-[50%]" callback={handleEdit}>
						Edit Profile
					</Button>
				</div>
				<div class="w-full md:hidden">
					<Button size="sm" callback={() => goto(`/settings`)}>Settings</Button>
				</div>
			{:else if variant === 'other'}
				<div class="flex w-full justify-around">
					<Button size="sm" class="w-full md:w-[50%]" callback={handleFollow}>
						Follow
					</Button>
				</div>
				<div class="w-full md:hidden">
					<Button size="sm" callback={handleMessage}>Message</Button>
				</div>
			{/if}
		</div>
	</div>
	<div class="grid grid-cols-3 gap-[2px] pb-16">
		{#each profileData.posts as post}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				onclick={() => {
					handleSinglePost && handleSinglePost(post);
				}}
			>
				<img
					class="aspect-square w-48 rounded-md object-cover md:max-w-56"
					src={post.imgUris[0]}
					alt="user post"
				/>
			</div>
		{/each}
	</div>
</div>
