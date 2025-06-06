<script lang="ts">
	import { goto } from '$app/navigation';
	import { SettingsTile, UploadedPostView } from '$lib/fragments';
	import { audience, uploadedImages } from '$lib/store/store.svelte';
	import { Button } from '$lib/ui';
</script>

<section class="h-[75svh] relative flex flex-col gap-10 justify-stretch">
	<UploadedPostView
		images={uploadedImages.value ?? []}
		width="w-auto"
		height="h-60"
		callback={(i: number) => {
			if (uploadedImages.value)
				uploadedImages.value = uploadedImages.value.filter((_, index) => index !== i);
		}}
	/>

	<SettingsTile
		title="Who can see your posts?"
		currentStatus={audience.value}
		onclick={() => goto('/post/audience')}
	/>

	<Button variant="secondary" callback={() => alert('TODO: Post created!')} class="absolute bottom-0">Post</Button>
</section>
