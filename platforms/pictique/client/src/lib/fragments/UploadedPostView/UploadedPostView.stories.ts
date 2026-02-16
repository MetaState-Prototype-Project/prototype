import type { ComponentProps } from 'svelte';
import UploadedPostView from './UploadedPostView.svelte';

export default {
	title: 'UI/UploadedPostView',
	component: UploadedPostView,
	tags: ['autodocs'],
	render: (args: {
		Component: UploadedPostView;
		props: ComponentProps<typeof UploadedPostView>;
	}) => ({
		Component: UploadedPostView,
		props: args
	})
};

let images = [
	{
		url: 'https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250',
		alt: 'Sample Image 1'
	},
	{
		url: 'https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250',
		alt: 'Sample Image 1'
	},
	{
		url: 'https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250',
		alt: 'Sample Image 1'
	},
	{
		url: 'https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250',
		alt: 'Sample Image 1'
	},
	{
		url: 'https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250',
		alt: 'Sample Image 1'
	},
	{
		url: 'https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250',
		alt: 'Sample Image 1'
	}
];

export const Primary = {
	args: {
		images: images,
		callback: (i: number) => {
			images = images.filter((_, index) => index !== i);
		}
	}
};
