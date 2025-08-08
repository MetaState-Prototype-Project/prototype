<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLImgAttributes } from 'svelte/elements';

	interface IAvatarProps extends HTMLImgAttributes {
		src: string;
		alt?: string;
		size?: 'xs' | 'sm' | 'md' | 'lg';
	}

	const { src, alt = 'User Avatar', size = 'md', ...restProps }: IAvatarProps = $props();

	let img = $state(src);
	let hasError = $state(false);

	const sizeVariant = {
		xs: 'w-6 h-6',
		sm: 'w-10 h-10',
		md: 'w-12 h-12',
		lg: 'w-30 h-30'
	};

	const classes = $derived({
		common: cn('rounded-full'),
		size: sizeVariant[size] || sizeVariant.md
	});

	function handleError() {
		hasError = true;
		img = '/images/user.png';
	}

	$inspect(img);
</script>

{#if hasError || !img}
	<div
		class={cn(
			[
				classes.common,
				classes.size,
				'flex items-center justify-center bg-gray-300',
				restProps.class
			].join(' ')
		)}
	>
		<svg class="h-1/2 w-1/2 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
			<path
				fill-rule="evenodd"
				d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
				clip-rule="evenodd"
			/>
		</svg>
	</div>
{:else}
	<img
		{...restProps}
		onerror={handleError}
		src={img}
		{alt}
		class={cn([classes.common, classes.size, restProps.class].join(' '))}
	/>
{/if}

<!--
@component
@name Avatar
@description Avatar component for displaying user profile pictures or icons.
@props
    - src: The source URL of the image.
    - alt: The alternative text for the image.
    - size: The size of the avatar. Can be 'xs', 'sm', 'md', or 'lg'. Default is 'md'.
@usage
    <script>
        import { Avatar } from "$lib/ui";
    </script>

    <Avatar src="https://example.com/avatar.jpg" alt="User Avatar" size="lg" />
-->
