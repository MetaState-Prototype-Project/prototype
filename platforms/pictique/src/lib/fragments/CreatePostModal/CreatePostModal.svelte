<script lang="ts">
	import { closeCreatePostModal, createPost } from '$lib/stores/posts';
	import { Button, Modal } from '$lib/ui';

	let { open = $bindable() }: { open: boolean } = $props();

	let text = $state('');
	let images = $state<string[]>([]);
	let isSubmitting = $state(false);

	const handleImageUpload = (event: Event) => {
		const input = event.target as HTMLInputElement;
		if (!input.files?.length) return;

		const file = input.files[0];
		const reader = new FileReader();
		reader.onload = (e) => {
			const result = e.target?.result;
			if (typeof result === 'string') {
				console.log(result);
				images = [...images, result];
			}
		};
		reader.readAsDataURL(file);
	};

	const removeImage = (index: number) => {
		images = images.filter((_, i) => i !== index);
	};

	const handleSubmit = async () => {
		if (!text.trim() && images.length === 0) return;

		try {
			isSubmitting = true;
			await createPost(text, images);
			closeCreatePostModal();
			text = '';
			images = [];
		} catch (error) {
			console.error('Failed to create post:', error);
		} finally {
			isSubmitting = false;
		}
	};
</script>

<Modal {open} onclose={closeCreatePostModal}>
	<div class="w-full max-w-2xl rounded-lg bg-white p-6">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-xl font-semibold">Create Post</h2>
			<button
				type="button"
				class="rounded-full p-2 hover:bg-gray-100"
				onclick={closeCreatePostModal}
			>
				✕
			</button>
		</div>

		<div class="mb-4">
			<!-- svelte-ignore element_invalid_self_closing_tag -->
			<textarea
				bind:value={text}
				placeholder="What's on your mind?"
				class="focus:border-brand-burnt-orange w-full resize-none rounded-lg border border-gray-200 p-4 focus:outline-none"
				rows="4"
			/>
		</div>

		{#if images.length > 0}
			<div class="mb-4 grid grid-cols-2 gap-4">
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
						>
							✕
						</button>
					</div>
				{/each}
			</div>
		{/if}

		<div class="flex items-center justify-between gap-2">
			<label
				class="w-full cursor-pointer rounded-full bg-gray-100 px-4 py-3 text-center hover:bg-gray-200"
			>
				<input type="file" accept="image/*" class="hidden" onchange={handleImageUpload} />
				Add Photo
			</label>

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
