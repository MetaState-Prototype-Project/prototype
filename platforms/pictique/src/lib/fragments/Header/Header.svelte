<script lang="ts">
	import { page } from '$app/state';
	import { cn } from '$lib/utils';
	import { ArrowLeft01Icon, ArrowLeft02Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	const { ...restProps }: HTMLAttributes<HTMLElement> = $props();

	let route = $derived(page.url.pathname);
	let heading = $state('');

	$effect(() => {
		if (route.includes('home')) {
			heading = 'Feed';
		} else if (route.includes('/discover')) {
			heading = 'Search';
		} else if (route.includes('/post/audience')) {
			heading = 'Audience';
		} else if (route.includes('/post')) {
			heading = 'Upload photo';
		} else if (route === '/messages') {
			heading = 'Messages';
		} else if (route.includes('/settings')) {
			heading = 'Settings';
		} else if (route.includes('/profile')) {
			heading = 'Profile';
		}
	});

	type Variant = 'primary' | 'secondary' | 'tertiary';

	let variant = $derived.by((): Variant => {
		if (route === `/messages/${page.params.id}` || route.includes('/post')) {
			return 'secondary';
		}
		if (route.includes('profile')) {
			return 'tertiary';
		}
		return 'primary';
	});

	const variantClasses: Record<Variant, { text: string; background: string }> = {
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
