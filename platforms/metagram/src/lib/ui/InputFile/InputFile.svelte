<script lang="ts">
	import { Album01Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	interface IInputFileProps {
		files: FileList | undefined;
		placeholder: string;
	}

	let { files = $bindable() }: IInputFileProps = $props();

	const uniqueId = Math.random().toString().split('.')[1];
	let inputFile: HTMLInputElement | undefined = $state();

	function cancelUpload(e: MouseEvent) {
		e.preventDefault();
		if (inputFile) inputFile.value = '';
		files = undefined;
	}

	$effect(() => {
		console.log(files);
	});
</script>

<input id={uniqueId} type="file" bind:files class="hidden" accept="image/*" bind:this={inputFile} />

<label
	for={uniqueId}
	class="bg-grey text-black-400 font-geist flex h-[158px] w-full items-center justify-center rounded-4xl text-base font-normal"
>
	{#if files}
		<div class="flex flex-col items-center gap-2">
			<HugeiconsIcon size="24px" icon={Album01Icon} color="var(--color-black-600)" />
			<h3 class="text-black-800">{files[0].name.slice(0, 10) + '...'}</h3>
			<button
				type="button"
				onclick={(e) => cancelUpload(e)}
				class="text-brand-burnt-orange underline decoration-solid"
			>
				Delete Upload
			</button>
		</div>
	{:else}
		<div class="flex flex-col items-center gap-2">
			<HugeiconsIcon size="24px" icon={Album01Icon} color="var(--color-black-600)" />
			Click to upload a photo
		</div>
	{/if}
</label>
