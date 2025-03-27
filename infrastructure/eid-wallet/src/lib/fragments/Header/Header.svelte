<script lang="ts">
import { cn } from "$lib/utils";
import { ArrowLeft01Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import type { HTMLAttributes } from "svelte/elements";

interface IHeaderProps extends HTMLAttributes<HTMLElement> {
	title: string;
	isUserLoggedIn?: boolean;
	isBackRequired?: boolean;
	handleProfile?: () => void;
}

let {
	title = "Create PIN",
	isUserLoggedIn = true,
	isBackRequired = true,
	handleProfile = undefined,
	...restProps
}: IHeaderProps = $props();
const cBase = "w-full h-[9vh] flex justify-between items-center";
</script>

<header {...restProps} class={cn(cBase, restProps.class)}>
    {#if isBackRequired}
        <button class="flex justify-start" onclick={() => window.history.back()}>
            <HugeiconsIcon size="5.5vw"  color="var(--color-black-700)" icon={ArrowLeft01Icon} />
        </button>
    {:else}
        <!-- svelte-ignore element_invalid_self_closing_tag -->
        <span aria-hidden="true"/>
    {/if}
    <h1 class="text-3xl text-black text-center font-semibold">{title}</h1>
    {#if isUserLoggedIn}
        <button class="flex justify-end" onclick={handleProfile}>
            <HugeiconsIcon size="8.1vw" color="var(--color-black-700)" icon={UserCircleIcon} />
        </button>
    {:else}
        <!-- svelte-ignore element_invalid_self_closing_tag -->
        <span aria-hidden="true"/>
    {/if}
</header>