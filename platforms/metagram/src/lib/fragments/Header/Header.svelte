<script lang="ts">
	import { cn } from '$lib/utils';
	import { ZapIcon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface IHeaderProps extends HTMLAttributes<HTMLElement> {
		variant: 'primary' | 'secondary';
		heading: string;
		callback?: () => void;
	}

	const { variant, callback, heading, ...restProps }: IHeaderProps = $props();

	const variantClasses = {
		primary: {
			text: 'text-transparent bg-clip-text bg-[image:var(--color-brand-gradient)]'
		},
		secondary: {
			text: ''
		}
	};

	const classes = $derived({
		common: cn('flex items-center justify-between p-4'),
		text: cn([variantClasses[variant].text, ''])
	});
</script>

<header {...restProps} class={cn([classes.common, restProps.class])}>
	<h1 class={cn([classes.text])}>
		{heading}
	</h1>
	{#if callback}
		<button class="cursor-pointer rounded-full p-2 hover:bg-gray-100" onclick={callback}>
			<HugeiconsIcon icon={ZapIcon} size={18} color="var(--color-black-500)" />
		</button>
	{/if}
</header>

<!--
@component
@name Header
@description Header fragment.
@props
    - variant: Can be 'primary' for home screen header with a flash, 'secondary' without flash, or 'tertiary'.
    - heading: The main heading text.
    - callback: A function to be called when the header is clicked.
@usage
    <script>
        import { Header } from "$lib/fragments";
    </script>

    <Header variant="primary" heading="metagram" callback={() => console.log('Header clicked')} />
-->
