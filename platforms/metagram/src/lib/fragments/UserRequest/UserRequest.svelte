<script lang="ts">
	import { Avatar } from '$lib/ui';
	import Button from '$lib/ui/Button/Button.svelte';
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	interface IUserRequestprops extends HTMLAttributes<HTMLElement> {
		userImgSrc: string;
		userName: string;
		description: string;
		handleFollow: () => Promise<void>;
	}

	let { userImgSrc, userName, description, handleFollow, ...restProps }: IUserRequestprops =
		$props();
</script>

<article {...restProps} class={cn(['flex justify-between', restProps.class].join(' '))}>
	<Avatar size="md" src={userImgSrc} />
	<div class="ms-2 me-4.5">
		<h3 class="font-semibold text-black">{userName}</h3>
		<p class="text-black-600">{description}</p>
	</div>
	<Button variant="secondary" size="sm" callback={handleFollow}>Follow</Button>
</article>
