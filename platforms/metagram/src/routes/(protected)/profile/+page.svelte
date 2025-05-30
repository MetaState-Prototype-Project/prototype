<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/ui';

	let userImage: string = $state('https://picsum.photos/200/300');
	let username: string = $state('_.ananyayaya_.');
	let user: string = $state('Ananya Rana');
	let followers: number = $state(24);
	let following: number = $state(56);
	let totalPosts: number = $state(10);
	let userBio: string = $state(
		'Friendly nerd who likes to not meet people as much as possible. Leave the earth for me yall.'
	);
	let posts: string[] = $state([
		'https://picsum.photos/id/1011/200/200',
		'https://picsum.photos/id/1012/200/200',
		'https://picsum.photos/id/1013/200/200',
		'https://picsum.photos/id/1014/200/200',
		'https://picsum.photos/id/1015/200/200',
		'https://picsum.photos/id/1016/200/200'
	]);
</script>

<div class="bg-grey flex h-full w-full flex-col items-center gap-4 pt-[10%]">
	<div class="flex flex-col items-center gap-4 p-4">
		<img class="size-28 rounded-full" src={userImage} alt="" />
		<div class="flex flex-col items-center gap-2">
			<p class="font-semibold">{username}</p>
			<p class="text-black-600">{user}</p>
		</div>
		<div class="text-black-600 flex gap-4">
			<p><span class="font-semibold text-black">{followers}</span> followers</p>
			<p><span class="font-semibold text-black">{following}</span> following</p>
			<p><span class="font-semibold text-black">{totalPosts}</span> posts</p>
		</div>
		<div class="text-black-600 px-12 text-center text-sm">
			{userBio}
		</div>
		<div class="flex w-full gap-3">
			<div class="w-full">
				<Button size="sm" class="w-full">Edit Profile</Button>
			</div>
			<div class="w-full">
				<Button size="sm" callback={() => goto(`/settings`)}>Settings</Button>
			</div>
		</div>
	</div>
	<div class="grid grid-cols-3 gap-[2px]">
		{#each posts as post}
			<img class="aspect-square rounded-md object-cover" src={post} alt="user post" />
		{/each}
	</div>
</div>
