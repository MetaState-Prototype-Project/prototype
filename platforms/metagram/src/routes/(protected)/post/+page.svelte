<script lang="ts">
	import { goto } from '$app/navigation';
	import { SettingsTile, UploadedPostView } from '$lib/fragments';
    import { uploadedImages } from '$lib/store/store.svelte';
</script>

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
    currentStatus="Everyone"
    onclick={() => goto("/post/audience")}
/>
