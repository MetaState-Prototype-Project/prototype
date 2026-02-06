<script lang="ts">
	import { goto } from '$app/navigation';
	import { SettingsTile, UploadedPostView } from '$lib/fragments';
	import { audience, uploadedImages } from '$lib/store/store.svelte';
	import { createPost } from '$lib/stores/posts';
	import { Button, Textarea } from '$lib/ui';
	import { revokeImageUrls } from '$lib/utils';

	let caption: string = $state('');

	$effect(() => {
		if (!uploadedImages.value || uploadedImages.value.length === 0) {
			window.history.back();
		}
	});

	const handleImageUpload = (event: Event) => {
		const input = event.target as HTMLInputElement;
		if (!input.files?.length) return;

		const file = input.files[0];
		const reader = new FileReader();
		reader.onload = (e) => {
			const result = e.target?.result;
			if (typeof result === 'string' && uploadedImages.value) {
				uploadedImages.value = [...uploadedImages.value, { url: result, alt: file.name }];
			}
		};
		reader.readAsDataURL(file);
		input.value = '';
	};

	const postSubmissionHandler = async () => {
		if (!uploadedImages.value) return;
		const images = uploadedImages.value.map((img) => img.url);
		try {
			await createPost(caption, images);
		} catch (error) {
			console.error('Failed to create post:', error);
		}
	};
</script>

<section class="flex h-fit w-full flex-col justify-stretch gap-3">
	<div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
		{#each uploadedImages.value ?? [] as image, i (i)}
			<div class="group relative aspect-square">
				<button
					type="button"
					class="absolute top-2 right-2 z-10 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
					onclick={() => {
						if (uploadedImages.value)
							uploadedImages.value = uploadedImages.value.filter((img, index) => {
								if (index === i) revokeImageUrls([img]);
								return index !== i;
							});
					}}
					aria-label="Remove image"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
				<img
					src={image.url}
					alt={image.alt}
					class="h-full w-full rounded-lg object-cover"
				/>
			</div>
		{/each}

		<!-- Add Photo Frame -->
		<label
			class="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-gray-400 hover:bg-gray-100"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-8 w-8 text-gray-400"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
			</svg>
			<span class="text-sm font-medium text-gray-600">Add Photo</span>
			<input type="file" accept="image/*" class="hidden" onchange={handleImageUpload} />
		</label>
	</div>

	<label for="caption">
		<span class="mb-2 block font-semibold">Add a caption</span>
		<Textarea name="caption" rows={3} bind:value={caption} placeholder="Hey guys..." />
	</label>

	<!-- <SettingsTile
		title="Who can see your posts?"
		currentStatus={audience.value}
		onclick={() => goto('/post/audience')}
	/> -->

	<Button
		variant="secondary"
		blockingClick={true}
		disabled={!uploadedImages.value || uploadedImages.value?.length <= 0}
		callback={postSubmissionHandler}
		class="mt-1">Post</Button
	>
</section>
