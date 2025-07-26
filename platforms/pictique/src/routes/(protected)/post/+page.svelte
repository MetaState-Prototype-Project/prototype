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
	<UploadedPostView
		images={uploadedImages.value ?? []}
		width="w-auto"
		height="h-40"
		callback={(i: number) => {
			if (uploadedImages.value)
				uploadedImages.value = uploadedImages.value.filter((img, index) => {
					revokeImageUrls([img]);
					return index !== i;
				});
		}}
	/>

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
