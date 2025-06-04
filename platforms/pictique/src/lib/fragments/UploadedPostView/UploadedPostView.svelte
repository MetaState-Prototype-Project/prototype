<script lang="ts">
	import { Cross } from '$lib/icons';
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	interface IImage {
		url: string;
		alt: string;
	}

	interface IUploadedPostViewProps extends HTMLAttributes<HTMLElement> {
		images: IImage[];
		width?: string;
		height?: string;
		callback: (i: number) => void;
	}

	let {
		images,
		width = 'w-full',
		height = 'h-full',
		callback,
		...restProps
	}: IUploadedPostViewProps = $props();
</script>

<article
	{...restProps}
	class={cn(
		['max-w-screen flex flex-row items-center gap-4 scroll-auto', restProps.class].join(' ')
	)}
>
	{#each images as image, i}
		<div class={cn(['group relative shrink-0'])}>
			<Cross
				class="absolute right-0 top-0 hidden -translate-y-1/2 translate-x-1/2 cursor-pointer group-hover:block"
				onclick={() => callback(i)}
			/>
			<img
				src={image.url}
				alt={image.alt}
				class={cn(['rounded-lg outline-[#DA4A11] group-hover:outline-2', width, height])}
			/>
		</div>
	{/each}
</article>

<!--
    @component
    export default UploadedPostView
    @description
    This component is a view for displaying uploaded images in a post. It allows users to see the images they have uploaded and provides a way to remove individual images.

    @props
    - images: An array of image objects, each containing a `url` and `alt` text.
	- width: The width of the image container. Default is `w-full`.
	- height: The height of the image container. Default is `h-full`.
	- callback: A function that is called when the cross on the image is clicked, passing the index of the clicked image.
    - ...restProps: Any other props that can be passed to a image container element.

    @usage
    ```html
    <script lang="ts">
		import { UploadedPostView } from '$lib/fragments';
    </script>

	<UploadedPostView
		images={[
		{
			url: "https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250",
			alt: "Sample Image 1",
		},
		{
			url: "https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250",
			alt: "Sample Image 1",
        }]}
		callback={(i: number) => {
            images = images.filter((_, index) => index !== i);
        }}
    />
    ```
-->
