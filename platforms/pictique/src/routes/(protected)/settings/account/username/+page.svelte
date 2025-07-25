<script lang="ts">
	import { InputFile } from '$lib/fragments';
	import { Button, Input, Label } from '$lib/ui';
	import { apiClient } from '$lib/utils/axios';
	import { onMount } from 'svelte';

	let handle = $state();
	let name = $state();
	let profileImageDataUrl = $state('');
	let files = $state<FileList | undefined>();
	let saved = $state(false);

	function handleFileChange() {
		if (files?.[0]) {
			const file = files[0];
			const reader = new FileReader();

			reader.onload = (e) => {
				if (e.target?.result) {
					profileImageDataUrl = e.target.result as string;
				}
			};

			reader.readAsDataURL(file);
		}
	}

	async function saveProfileData() {
		try {
			await apiClient.patch('/api/users/', {
				handle,
				avatar: profileImageDataUrl,
				name
			});
			saved = true;
			setTimeout(() => {
				saved = false;
			}, 3_000);
		} catch (err) {
			console.log(err instanceof Error ? err.message : 'please check the info again');
		}
	}

	$effect(() => {
		if (files) {
			handleFileChange();
		}
	});

	onMount(async () => {
		const { data } = await apiClient.get('/api/users');
		handle = data.handle;
		name = data.name;
	});
</script>

<div class="flex flex-col gap-6">
	{#if saved}
		<div class=" w-full rounded-md bg-[#33cc33] px-10 py-2 text-center text-white">
			Changes Saved!
		</div>
	{/if}
	<div>
		<Label>Change your profile picture</Label>
		<InputFile
			bind:files
			accept="image/*"
			label="Upload Profile Picture"
			cancelLabel="Remove"
			oncancel={() => {
				profileImageDataUrl = '';
				files = undefined;
			}}
		/>
		{#if profileImageDataUrl}
			<img
				src={profileImageDataUrl}
				alt="Profile preview"
				class="mt-2 h-32 w-32 rounded-full object-cover"
			/>
		{/if}
	</div>

	<div>
		<Label>Change your username</Label>
		<Input type="text" placeholder="Edit Username" bind:value={handle} />
	</div>
	<div>
		<Label>Profile Name</Label>
		<Input type="text" placeholder="Edit your public name" bind:value={name} />
	</div>
</div>
<hr class="text-grey" />
<Button size="sm" variant="secondary" callback={saveProfileData}>Save Changes</Button>
