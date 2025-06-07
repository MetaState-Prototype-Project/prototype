<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { createPost } from '$lib/stores/posts';
	import Button from '$lib/ui/Button/Button.svelte';

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	let text = '';
	let images: string[] = [];
	let isUploading = false;

	const handleImageUpload = async (event: Event) => {
		const input = event.target as HTMLInputElement;
		if (!input.files?.length) return;

		isUploading = true;
		const newImages: string[] = [];

		for (const file of Array.from(input.files)) {
			const reader = new FileReader();
			const dataUri = await new Promise<string>((resolve) => {
				reader.onload = () => resolve(reader.result as string);
				reader.readAsDataURL(file);
			});
			console.log('HERRREE');
			newImages.push(dataUri);
		}

		images = [...images, ...newImages];
		isUploading = false;
	};

	const removeImage = (index: number) => {
		images = images.filter((_, i) => i !== index);
	};

	const handleSubmit = async () => {
		try {
			await createPost(text, images);
			dispatch('close');
		} catch (error) {
			console.error('Failed to create post:', error);
		}
	};
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
	<div class="w-full max-w-2xl rounded-lg bg-white p-6">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-xl font-semibold">Create Post</h2>
			<button
				type="button"
				class="text-gray-500 hover:text-gray-700"
				on:click={() => dispatch('close')}
			>
				✕
			</button>
		</div>

		<form on:submit|preventDefault={handleSubmit} class="space-y-4">
			<textarea
				bind:value={text}
				placeholder="What's on your mind??"
				class="focus:border-brand-burnt-orange w-full rounded-lg border border-gray-300 p-3 focus:outline-none"
				rows="4"
			/>

			<div class="space-y-2">
				<label class="block text-sm font-medium text-gray-700"> Add Images </label>
				<input
					type="file"
					accept="image/*"
					multiple
					on:change={handleImageUpload}
					class="file:bg-brand-burnt-orange hover:file:bg-brand-burnt-orange-600 block w-full text-sm text-gray-500 file:mr-4 file:rounded-full file:border-0 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
				/>
			</div>

			{#if images.length > 0}
				<div class="grid grid-cols-3 gap-4">
					{#each images as image, index}
						<div class="relative">
							<img
								src={image}
								alt="Upload preview"
								class="aspect-square rounded-lg object-cover"
							/>
							<button
								type="button"
								class="absolute -top-2 -right-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
								on:click={() => removeImage(index)}
							>
								✕
							</button>
						</div>
					{/each}
				</div>
			{/if}

			<div class="flex justify-end gap-4">
				<Button type="button" variant="secondary" on:click={() => dispatch('close')}>
					Cancel
				</Button>
				<Button
					type="submit"
					variant="primary"
					disabled={isUploading || (!text && images.length === 0)}
				>
					{isUploading ? 'Uploading...' : 'Post'}
				</Button>
			</div>
		</form>
	</div>
</div>
