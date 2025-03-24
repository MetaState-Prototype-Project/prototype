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

<header class="flex justify-between items-center">
    {#if isBackRequired}
    <HugeiconsIcon size="5.5vw"  color="var(--color-black-700)" icon={ArrowLeft01Icon} />
    {/if}
    <h1 class="text-3xl text-black font-semibold">{title}</h1>
    {#if isUserLoggedIn}
    <HugeiconsIcon size="8.1vw" color="var(--color-black-700)" icon={UserCircleIcon} />
    {/if}
</header>