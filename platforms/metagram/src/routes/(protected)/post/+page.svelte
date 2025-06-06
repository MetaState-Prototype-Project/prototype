<script lang="ts">
	import { UploadedPostView } from '$lib/fragments';
    import { uploadedImages } from '$lib/store/store.svelte';
</script>

<UploadedPostView
    images={uploadedImages.value ?? []}
    callback={(i: number) => {
        if (uploadedImages.value)
        uploadedImages.value = uploadedImages.value.filter((_, index) => index !== i);
    }}
/>
