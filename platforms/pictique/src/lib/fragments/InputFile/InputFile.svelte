<script lang="ts">
	import { Album01Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	interface IInputFileProps {
		files: FileList | undefined;
		accept: string;
		label: string;
		cancelLabel: string;
		oncancel: () => void;
	}

	let {
		files = $bindable(),
		accept = 'image/*',
		label = 'Click to upload a photo',
		cancelLabel = 'Delete upload',
		oncancel
	}: IInputFileProps = $props();

	const uniqueId = Math.random().toString().split('.')[1];
	let inputFile: HTMLInputElement | undefined = $state();
</script>

<input id={uniqueId} type="file" bind:files class="hidden" {accept} bind:this={inputFile} />

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
				{oncancel}
				class="text-brand-burnt-orange underline decoration-solid"
			>
				{cancelLabel}
			</button>
		</div>
	{:else}
		<div class="flex flex-col items-center gap-2">
			<HugeiconsIcon size="24px" icon={Album01Icon} color="var(--color-black-600)" />
			{label}
		</div>
	{/if}
</label>

<!--
	@component
	export default InputFile;
	@description
	A styled file input component with a custom label, file preview, and a cancel button.
	Supports binding file selection and a cancel handler.

	@props
	- files: The bound FileList or undefined.
	- accept: The accepted file types (default: "image/*").
	- label: Label text shown when no file is selected (default: "Click to upload a photo").
	- cancelLabel: Text for the cancel button (default: "Delete upload").
	- oncancel: Function called when user clicks the cancel button.

	@usage
	```html
	<script lang="ts">
		import InputFile from './InputFile.svelte';
		let files: FileList | undefined;

		function handleCancel() {
			files = undefined;
		}
	</script>

	<InputFile
		bind:files
		accept="image/png, image/jpeg"
		label="Upload your profile photo"
		cancelLabel="Remove"
		oncancel={handleCancel}
	/>
	```
-->
