<script lang="ts">
    import { ArrowLeft01Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
    import { HugeiconsIcon } from "@hugeicons/svelte";
    import type { HTMLAttributes } from "svelte/elements";

    interface IHeaderProps extends HTMLAttributes<HTMLElement> {
        title: string
        isUserLoggedIn?: boolean;
        isBackRequired?: boolean;
    }

    let {title= "Create PIN", isUserLoggedIn = true, isBackRequired = true}:IHeaderProps = $props()
</script>

<header class="h-[5.2vh] grid grid-cols-3 items-center">
    {#if isBackRequired}
    <span class="flex justify-start">
        <HugeiconsIcon size="5.5vw"  color="var(--color-black-700)" icon={ArrowLeft01Icon} />
    </span>
    {:else}
    <!-- svelte-ignore element_invalid_self_closing_tag -->
    <span aria-hidden="true"/>
    {/if}
    <h1 class="text-3xl text-black text-center font-semibold">{title}</h1>
    {#if isUserLoggedIn}
    <span class="flex justify-end">
        <HugeiconsIcon size="8.1vw" color="var(--color-black-700)" icon={UserCircleIcon} />
    </span>
    {:else}
    <!-- svelte-ignore element_invalid_self_closing_tag -->
    <span aria-hidden="true"/>
    {/if}
</header>