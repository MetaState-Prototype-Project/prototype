<script lang="ts">
	import { InputFile } from '$lib/fragments';
	import { Button, Input, Label, Textarea } from '$lib/ui';
	import { apiClient } from '$lib/utils/axios';
	import { onMount } from 'svelte';

	let handle = $state();
	let name = $state();
	let profileImageDataUrl = $state('');
	let files = $state<FileList | undefined>();
	let saved = $state(false);
	let isSaving = $state(false);
	let error = $state('');

	const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB

	function handleFileChange() {
		if (files?.[0]) {
			const file = files[0];

			// Validate file size
			if (file.size > MAX_FILE_SIZE) {
				error = 'Image must be smaller than 1MB';
				files = undefined;
				return;
			}

			error = '';
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
		if (isSaving) return;

		try {
			isSaving = true;
			await apiClient.patch('/api/users/', {
				name,
				avatar: profileImageDataUrl
			});
			saved = true;
			setTimeout(() => {
				saved = false;
			}, 3_000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save changes';
		} finally {
			isSaving = false;
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
		profileImageDataUrl = data.avatarUrl;
	});
</script>

<div class="flex flex-col gap-6">
	{#if saved}
		<div class="w-full rounded-md bg-[#33cc33] px-10 py-2 text-center text-white">
			Changes Saved!
		</div>
	{/if}
	{#if error}
		<div class="w-full rounded-md bg-red-500 px-10 py-2 text-center text-white">
			{error}
		</div>
	{/if}
	<div>
		<Label>Change your profile picture</Label>
		<p class="mb-2 text-sm text-gray-600">Maximum file size: 1MB</p>

		<div class="flex items-center gap-4">
			{#if profileImageDataUrl}
				<img
					src={profileImageDataUrl}
					alt="Profile preview"
					class="h-24 w-24 rounded-full border-2 border-gray-200 object-cover"
				/>
			{:else}
				<div class="flex h-24 w-24 items-center justify-center rounded-full bg-gray-200">
					<span class="text-sm text-gray-400">No image</span>
				</div>
			{/if}

			<div class="flex-1">
				<InputFile
					bind:files
					accept="image/*"
					label="Upload Profile Picture"
					cancelLabel="Remove"
					oncancel={() => {
						profileImageDataUrl = '';
						files = undefined;
						error = '';
					}}
				/>
			</div>
		</div>
	</div>

	<div>
		<Label>eName</Label>
		<Input
			type="text"
			placeholder="Your eName"
			bind:value={handle}
			disabled
			class="cursor-not-allowed opacity-70"
		/>
	</div>
	<div>
		<Label>Profile Name</Label>
		<Input type="text" placeholder="Edit  your public name" bind:value={name} />
	</div>
</div>
<hr class="text-grey" />
<Button
	size="sm"
	variant="secondary"
	callback={saveProfileData}
	isLoading={isSaving}
	disabled={isSaving}
>
	{isSaving ? 'Saving...' : 'Save Changes'}
</Button>
