<script lang="ts">
	import { cn } from '$lib/utils';
	import { ArrowLeft01Icon, ArrowLeft02Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface IHeaderProps extends HTMLAttributes<HTMLElement> {
		variant: 'primary' | 'secondary' | 'tertiary';
		heading?: string;
		isCallBackNeeded?: boolean;
		callback?: () => void;
		options?: { name: string; handler: () => void }[];
	}

	const { variant, isCallBackNeeded, callback, heading, ...restProps }: IHeaderProps = $props();

	const variantClasses = {
		primary: {
			text: 'text-transparent bg-clip-text bg-[image:var(--color-brand-gradient)] py-2',
			background: ''
		},
		secondary: {
			text: '',
			background: ''
		},
		tertiary: {
			text: '',
			background: 'bg-white/60'
		}
	};

	const backButton = {
		secondary: ArrowLeft01Icon,
		tertiary: ArrowLeft02Icon
	};

	// const menuButton = {
	// 	primary: ZapIcon,
	// 	secondary: MoreVerticalIcon,
	// 	tertiary: MoreVerticalIcon
	// };

	const classes = $derived({
		common: cn(
			'flex items-center justify-between my-4 w-full pb-2 border-b-[1px] md:border-0 border-grey'
		),
		text: variantClasses[variant].text,
		background: variantClasses[variant].background
	});

	const backButtonCallback = () => {
		window.history.back();
	};
</script>

<header {...restProps} class={cn([classes.common, restProps.class])}>
	<span class="flex items-center gap-2">
		{#if variant !== 'primary'}
			<button
				class={cn([
					'cursor-pointer rounded-full p-2 hover:bg-gray-100',
					classes.background
				])}
				onclick={backButtonCallback}
			>
				<HugeiconsIcon
					icon={backButton[variant]}
					size={24}
					color="var(--color-black-500)"
				/>
			</button>
		{/if}
		{#if variant !== 'tertiary'}
			<h1 class={cn([classes.text])}>
				{heading}
			</h1>
		{/if}
	</span>
	{#if isCallBackNeeded}
		<button
			class={cn(['cursor-pointer rounded-full p-2 hover:bg-gray-100', classes.background])}
			onclick={callback}
			aria-label="Callback"
		>
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

    <Header variant="primary" heading="metagram" callback={() => alert("clicked")} />
    <Header variant="primary" heading="messages" />
    <Header variant="secondary" heading="Account"  />
    <Header variant="secondary" heading="Account" callback={() => alert("clicked")} />
    <Header variant="tertiary" callback={() => alert("clicked")}  />
-->
