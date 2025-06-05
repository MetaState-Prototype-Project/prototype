<script lang="ts">
	import { UploadedPostView } from '$lib/fragments';
	import { onMount } from 'svelte';

	let images: FileList | null = $state(null);
    let imageInput: HTMLInputElement;
	let fileInputTrigger: HTMLButtonElement;

	onMount(() => {
		console.log(images);
		console.log(imageInput);
		if (images === null) {
		}
	})


</script>

<input type="file" accept="image/*" multiple bind:files={images} bind:this={imageInput} class="hidden" />

<button onclick={() => imageInput.click()} bind:this={fileInputTrigger}>click</button>
