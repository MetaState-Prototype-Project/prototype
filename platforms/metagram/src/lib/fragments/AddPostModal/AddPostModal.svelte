<script lang="ts">
	import { Button, InputRadio, Label, Textarea } from '$lib/ui';
	import type { CupertinoPane } from 'cupertino-pane';
	import { InputFile, Modal } from '..';

	let {
		files = $bindable(),
		caption = $bindable(),
		postVisibility = $bindable(),
		paneModal = $bindable()
	}: {
		files: FileList | undefined;
		caption: string;
		postVisibility: string;
		paneModal: CupertinoPane | undefined;
	} = $props();

	let isAddCaption = $state(false);
	let imagePreviews: string[] = $state([]);
	let postVisibilityOptions = ['Only followers', 'Close friends', 'Anyone'];

	$effect(() => {
		if (files) {
			const readers = Array.from(files).map((file) => {
				return new Promise<string>((resolve) => {
					const reader = new FileReader();
					reader.onload = (e) => resolve(e.target?.result as string);
					reader.readAsDataURL(file);
				});
			});

			Promise.all(readers).then((previews) => {
				imagePreviews = previews;
			});
		} else {
			imagePreviews = [];
		}
	});
</script>

<Modal
	bind:paneModal
	initialBreak="middle"
	handleDismiss={() => {
		(files = undefined), (isAddCaption = false);
	}}
>
	<h1 class="mb-6 font-semibold text-black">Upload a Photo</h1>
	{#if !isAddCaption}
		{#if !files}
			<InputFile class="mb-4 h-[40vh]" bind:files accept="images/*" multiple={true} />
		{:else}
			<div class="mb-4 grid grid-cols-3 gap-2">
				{#each imagePreviews as src}
					<div class="aspect-[4/5] overflow-hidden rounded-lg border">
						<!-- svelte-ignore a11y_img_redundant_alt -->
						<img {src} alt="Selected image" class="h-full w-full object-cover" />
					</div>
				{/each}
			</div>
		{/if}
	{:else if isAddCaption}
		<Label>Add a Caption</Label>
		<Textarea class="mb-4" bind:value={caption} placeholder="enter caption" />
		<div class="mb-4 flex items-center gap-2">
			{#each imagePreviews as src}
				<div class="h-[100px] w-[80px] overflow-hidden rounded-lg border">
					<!-- svelte-ignore a11y_img_redundant_alt -->
					<img {src} alt="Selected image" class="h-[100px] w-[80px] object-cover" />
				</div>
			{/each}
		</div>
		<h3 class="text-black-800 mt-20 mb-2">Who can see the post?</h3>
		{#each postVisibilityOptions as option, i}
			<div class="mb-2 flex w-[50%] items-center justify-between">
				<Label for={option + i}>{option}</Label>
				<InputRadio
					name="post-visibility"
					id={option + i}
					value={option}
					bind:selected={postVisibility}
				/>
			</div>
		{/each}
	{/if}
	{#if files}
		<div class="grid grid-cols-2 gap-2">
			<Button
				variant="secondary"
				size="sm"
				callback={async () => {
					files = undefined;
					isAddCaption = false;
					paneModal?.destroy({ animate: true });
				}}>Cancel</Button
			>
			<Button
				variant="secondary"
				size="sm"
				callback={async () => {
					isAddCaption = true;
				}}>Next</Button
			>
		</div>
	{/if}
</Modal>
