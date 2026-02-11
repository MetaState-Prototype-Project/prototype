<script lang="ts">
	import { Avatar, Input } from '$lib/ui';
	import Button from '$lib/ui/Button/Button.svelte';
	import { cn } from '$lib/utils';
	import { SentIcon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface IMessageInputProps extends HTMLAttributes<HTMLElement> {
		variant: 'comment' | 'dm';
		input?: HTMLInputElement;
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
		value = $bindable(),
		input = $bindable(),
		placeholder,
		files = $bindable(),
		handleSend,
		...restProps
	}: IMessageInputProps = $props();

	const cBase = 'flex items-center justify-between gap-2';

	let isSubmitting = $state(false);
	let isDisabled = $derived(!value.trim() || isSubmitting);

	const handleSubmit = async () => {
		if (isDisabled) return;
		isSubmitting = true;
		try {
			await handleSend();
		} finally {
			isSubmitting = false;
		}
	};
</script>

<div {...restProps} class={cn([cBase, restProps.class].join(' '))}>
	{#if variant === 'comment'}
		<Avatar size="sm" {src} />
	{/if}
	<Input
		type="text"
		bind:input
		bind:value
		{placeholder}
		onkeydown={(e) => {
			if (e.key === 'Enter' && !isDisabled) handleSubmit();
		}}
	/>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<Button
		class="bg-grey 	flex aspect-square h-13 w-13 items-center justify-center rounded-full px-0 transition-opacity {isDisabled
			? 'cursor-not-allowed opacity-50'
			: 'cursor-pointer hover:opacity-80'}"
		callback={handleSubmit}
		disabled={isDisabled}
	>
		<HugeiconsIcon size="24px" icon={SentIcon} color="var(--color-black-700)" />
	</Button>
</div>
