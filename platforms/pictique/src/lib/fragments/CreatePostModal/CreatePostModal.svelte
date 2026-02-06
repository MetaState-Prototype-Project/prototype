<script lang="ts">
	import { closeCreatePostModal, createPost } from '$lib/stores/posts';
	import { Button, Modal } from '$lib/ui';

	let { open = $bindable() }: { open: boolean } = $props();

	let text = $state('');
	let images = $state<string[]>([]);
	let imageFiles = $state<File[]>([]);
	let isSubmitting = $state(false);
	let error = $state('');

	const MAX_TOTAL_SIZE = 5 * 1024 * 1024; // 5MB total
	const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB per individual image

	let totalSize = $derived(imageFiles.reduce((sum, file) => sum + file.size, 0));
	let usagePercentage = $derived((totalSize / MAX_TOTAL_SIZE) * 100);
	let remainingSize = $derived(MAX_TOTAL_SIZE - totalSize);

	const formatSize = (bytes: number) => {
		if (bytes < 1024) return `${bytes}B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
	};

	const handleImageUpload = (event: Event) => {
		const input = event.target as HTMLInputElement;
		if (!input.files?.length) return;

		const file = input.files[0];

		// Validate individual file size
		if (file.size > MAX_FILE_SIZE) {
			error = `Image must be smaller than ${formatSize(MAX_FILE_SIZE)}`;
			input.value = '';
			return;
		}

		// Validate total size
		if (totalSize + file.size > MAX_TOTAL_SIZE) {
			error = `Adding this image would exceed the total limit of ${formatSize(MAX_TOTAL_SIZE)}`;
			input.value = '';
			return;
		}

		error = '';
		imageFiles = [...imageFiles, file];

		const reader = new FileReader();
		reader.onload = (e) => {
			const result = e.target?.result;
			if (typeof result === 'string') {
				console.log(result);
				images = [...images, result];
			}
		};
		reader.readAsDataURL(file);
		input.value = '';
	};

	const removeImage = (index: number) => {
		images = images.filter((_, i) => i !== index);
		imageFiles = imageFiles.filter((_, i) => i !== index);
		error = '';
	};

	const handleSubmit = async () => {
		if (!text.trim() && images.length === 0) return;

		try {
			isSubmitting = true;
			await createPost(text, images);
			closeCreatePostModal();
			text = '';
			images = [];
			imageFiles = [];
			error = '';
		} catch (error) {
			console.error('Failed to create post:', error);
		} finally {
			isSubmitting = false;
		}
	};
</script>

<Modal {open} onclose={closeCreatePostModal}>
	<div class="w-[80vw] max-w-sm rounded-lg bg-white p-6 sm:max-w-md md:max-w-lg lg:max-w-2xl">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-xl font-semibold">Create Post</h2>
			<button
				type="button"
				class="rounded-full p-2 hover:bg-gray-100"
				onclick={closeCreatePostModal}
			>
				{@render Cross()}
			</button>
		</div>

		{#if error}
			<div class="mb-4 rounded-md bg-red-500 px-4 py-2 text-sm text-white">
				{error}
			</div>
		{/if}

		<div class="mb-4">
			<!-- svelte-ignore element_invalid_self_closing_tag -->
			<textarea
				bind:value={text}
				placeholder="What's on your mind?"
				class="focus:border-brand-burnt-orange w-full resize-none rounded-lg border border-gray-200 p-4 focus:outline-none"
				rows="4"
			/>
		</div>

		<div class="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
			{#each images as image, index (index)}
				<div class="relative">
					<!-- svelte-ignore a11y_img_redundant_alt -->
					<img
						src={image}
						alt="Post image"
						class="aspect-square w-full rounded-lg object-cover"
					/>
					<button
						type="button"
						class="absolute top-2 right-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
						onclick={() => removeImage(index)}
						aria-label="Remove image"
					>
						{@render Cross()}
					</button>
				</div>
			{/each}

			<!-- Add Photo Frame -->
			{#if remainingSize > 0}
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
					<input
						type="file"
						accept="image/*"
						class="hidden"
						onchange={handleImageUpload}
					/>
				</label>
			{/if}
		</div>

		{#if images.length > 1}
			<div class="mb-4">
				<div class="mb-2 flex items-center justify-between text-sm">
					<span class="text-gray-600">
						{formatSize(totalSize)} / {formatSize(MAX_TOTAL_SIZE)}
					</span>
					<span class="text-gray-600">{formatSize(remainingSize)} remaining</span>
				</div>
				<div class="h-2 w-full overflow-hidden rounded-full bg-gray-200">
					<div
						class="h-full transition-all duration-300"
						class:bg-red-500={usagePercentage >= 90}
						class:bg-yellow-500={usagePercentage >= 70 && usagePercentage < 90}
						class:bg-green-500={usagePercentage < 70}
						style="width: {Math.min(usagePercentage, 100)}%"
					></div>
				</div>
			</div>
		{/if}

		<div class="flex justify-end">
			<Button
				variant="secondary"
				size="sm"
				callback={handleSubmit}
				isLoading={isSubmitting}
				disabled={!text.trim() && images.length === 0}
			>
				Post
			</Button>
		</div>
	</div>
</Modal>

{#snippet Cross()}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="h-4 w-4"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		stroke-width="2"
	>
		<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
	</svg>
{/snippet}
