<script lang="ts">
	interface IInputFileProps {
		files: FileList | undefined;
		placeholder: string;
	}

	let { files = $bindable() }: IInputFileProps = $props();

	const uniqueId = Math.random().toString().split('.')[1];

	$effect(() => {
		console.log(files);
	});
</script>

<input id={uniqueId} type="file" bind:files class="hidden" />

<label
	for={uniqueId}
	class="bg-grey text-black-400 font-geist flex h-[158px] w-full items-center justify-center rounded-4xl text-base font-normal"
>
	{#if files}
		<h3 class="text-black-800">{files[0].name.slice(0, 5) + '...'}</h3>
	{:else}
		Click to upload a photo
	{/if}
</label>
