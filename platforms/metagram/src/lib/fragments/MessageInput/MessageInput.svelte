<script lang="ts">
	import { Avatar, Input } from '$lib/ui';
	import { cn } from '$lib/utils';
	import { ImageAdd02Icon, PlusSignIcon, SentIcon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface IMessageInputProps extends HTMLAttributes<HTMLElement> {
		variant: 'comment' | 'dm';
		src: string;
		value: string;
		placeholder?: string;
		files?: FileList | undefined;
		handleAdd?: () => void;
		handleSend: () => Promise<void>;
	}

	let {
		variant = 'comment',
		src = 'https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250',
		value,
		placeholder,
		files = $bindable(),
		handleAdd,
		handleSend,
		...restProps
	}: IMessageInputProps = $props();

	const cBase = 'flex items-center justify-between gap-2';
</script>

<div {...restProps} class={cn([cBase, restProps.class].join(' '))}>
	{#if variant === 'comment'}
		<Avatar size="sm" {src} />
	{:else}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="bg-grey flex aspect-square h-13 w-13 items-center justify-center rounded-full"
			onclick={handleAdd}
		>
			<HugeiconsIcon size="24px" icon={PlusSignIcon} color="var(--color-black-400)" />
		</div>
	{/if}
	<Input type="text" bind:value {placeholder} />
	{#if value || variant === 'dm'}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="bg-grey flex aspect-square h-13 w-13 items-center justify-center rounded-full"
			onclick={handleSend}
		>
			<HugeiconsIcon size="24px" icon={SentIcon} color="var(--color-black-400)" />
		</div>
	{:else}
		<div class="bg-grey flex aspect-square h-13 w-13 items-center justify-center rounded-full">
			<input id="add-image" type="file" class="hidden" accept="image/*" bind:files />
			<label for="add-image">
				<HugeiconsIcon size="24px" icon={ImageAdd02Icon} color="var(--color-black-400)" />
			</label>
		</div>
	{/if}
</div>
