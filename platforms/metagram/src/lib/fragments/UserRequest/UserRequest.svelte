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

<article {...restProps} class={cn(['flex justify-between items-center', restProps.class].join(' '))}>
    <div class="me-4.5 flex items-start">
        <Avatar size="sm" src={userImgSrc} />
        <div class="ms-2">
            <h3 class="font-semibold text-black">{userName}</h3>
            <p class="text-black-600">{description}</p>
        </div>
    </div>
	<Button class="max-w-[100px]" variant="secondary" size="sm" callback={handleFollow}>Follow</Button>
</article>
