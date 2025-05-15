<script lang="ts">
	import { Avatar, Input } from '$lib/ui';
	import { cn } from '$lib/utils';
	import { ImageAdd02Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface IMessageInputProps extends HTMLAttributes<HTMLElement> {
		src: string;
		value: string;
		placeholder?: string;
		files?: FileList | undefined;
	}

	let {
		src = 'https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250',
		value,
		placeholder,
		files = $bindable(),
		...restProps
	}: IMessageInputProps = $props();

	const cBase = 'flex items-center justify-between gap-2';
</script>

<div {...restProps} class={cn([cBase, restProps.class].join(' '))}>
	<Avatar size="sm" {src} />
	<Input type="text" bind:value {placeholder} />
	<div class="bg-grey flex aspect-square h-13 w-13 items-center justify-center rounded-full">
		<input id="add-image" type="file" class="hidden" accept="image/*" bind:files />
		<label for="add-image">
			<HugeiconsIcon size="24px" icon={ImageAdd02Icon} color="var(--color-black-400)" />
		</label>
	</div>
</div>
