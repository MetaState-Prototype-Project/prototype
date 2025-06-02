<script lang="ts">
	import { Cross } from '$lib/icons';
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	interface IImage {
		url: string;
		alt: string;
	}

	interface IUploadedPostViewProps extends HTMLAttributes<HTMLImageElement> {
		images: IImage[];
		width?: string;
		height?: string;
	}

	let {
		images,
		width = 'w-full',
		height = 'h-full',
		...restProps
	}: IUploadedPostViewProps = $props();

	const crossHandler = (i: number) => {
		images = images.filter((_, index) => index !== i);
	};
</script>

<article class="max-w-screen flex flex-row items-center gap-4 scroll-auto">
	{#each images as image, i}
		<div class={cn(['group relative shrink-0'])}>
			<Cross
				class="absolute right-0 top-0 hidden -translate-y-1/2 translate-x-1/2 cursor-pointer group-hover:block"
				onclick={() => crossHandler(i)}
			/>
			<img
				{...restProps}
				src={image.url}
				alt={image.alt}
				class={cn([
					'rounded-lg outline-[#DA4A11] group-hover:outline-2',
					width,
					height,
					restProps.class
				])}
			/>
		</div>
	{/each}
</article>
