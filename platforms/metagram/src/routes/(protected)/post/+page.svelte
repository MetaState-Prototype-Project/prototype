<script lang="ts">
	import { goto } from '$app/navigation';
	import { SettingsTile, UploadedPostView } from '$lib/fragments';
	import { audience, uploadedImages } from '$lib/store/store.svelte';
	import { Button, Textarea } from '$lib/ui';

	let caption: string = $state('');
</script>

<section class="h-[75svh] w-full relative flex flex-col gap-5 justify-stretch">
	<UploadedPostView
		images={uploadedImages.value ?? []}
		width="w-auto"
		height="h-40"
		callback={(i: number) => {
			if (uploadedImages.value)
				uploadedImages.value = uploadedImages.value.filter((_, index) => index !== i);
		}}
	/>

    <label for="caption">
        <span class="block mb-2 font-semibold">Add a caption</span>
		<Textarea name="caption" rows={3} bind:value={caption} placeholder="Hey guys..." />
	</label>

	<SettingsTile
		title="Who can see your posts?"
		currentStatus={audience.value}
		onclick={() => goto('/post/audience')}
	/>

	<Button variant="secondary" callback={() => alert('TODO: Post created!')} class="relative bottom-0">Post</Button>
</section>
