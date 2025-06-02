<script lang="ts">
	import { Avatar } from "$lib/ui";
	import Button from "$lib/ui/Button/Button.svelte";
	import { cn } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";

    interface IUserRequestprops extends HTMLAttributes<HTMLElement> {
        userImgSrc: string;
        userName: string;
        description: string;
        handleFollow: () => Promise<void>;
    }

    let {userImgSrc, userName, description, handleFollow, ...restProps}:IUserRequestprops = $props()

</script>

<article {...restProps} class={cn(["flex justify-between", restProps.class].join(" "))}>
    <Avatar size="md" src='https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250' />
    <div class="ms-2 me-4.5">
        <h3 class="text-black font-semibold">luffythethird</h3>
        <p class="text-black-600">I’ve always wished life came at me fast. Funny how that wish never came through</p>
    </div>
    <Button variant="secondary" size="sm" callback={async() => alert("asdas")}>Follow</Button>
</article>