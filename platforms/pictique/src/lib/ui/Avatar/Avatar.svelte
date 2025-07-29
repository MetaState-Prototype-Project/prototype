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

	$inspect(img);
</script>

<img
	{...restProps}
	onerror={() => {
		img = '/images/user.png';
	}}
	src={img}
	{alt}
	class={cn([classes.common, classes.size, restProps.class].join(' '))}
/>

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
