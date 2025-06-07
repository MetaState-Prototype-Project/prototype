<script lang="ts">
	import { Button, Input, Label } from '$lib/ui';
	import { InputFile } from '$lib/fragments';
	import { apiClient } from '$lib/utils/axios';

	let handle = $state();
	let name = $state();
	let profileImageDataUrl = $state('');
	let files = $state<FileList | undefined>();

	function handleFileChange() {
		if (files && files[0]) {
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
		await apiClient.patch(`/api/users`, {
			handle,
			avatar: profileImageDataUrl,
			name
		});
	}

	$effect(() => {
		if (files) {
			handleFileChange();
		}
	});
</script>

<div class="flex flex-col gap-6">
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
