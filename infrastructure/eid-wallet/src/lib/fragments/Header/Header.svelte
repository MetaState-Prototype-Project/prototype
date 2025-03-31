<script lang="ts">
import { cn } from "$lib/utils";
import { ArrowLeft01Icon, Settings02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import type { HTMLAttributes } from "svelte/elements";
import * as Button from "$lib/ui/Button";

interface IHeaderProps extends HTMLAttributes<HTMLElement> {
	title: string;
	subtitle?: string;
	showSettings?: boolean;
	isBackRequired?: boolean;
	handleProfile?: () => void;
}

const {
	title,
	subtitle,
	showSettings = false,
	isBackRequired = false,
	handleProfile = undefined,
	...restProps
}: IHeaderProps = $props();

const classes = {
	common: "w-full flex",
	alignement: isBackRequired ? "justify-between items-center" : "items-start",
};
</script>

<header {...restProps} class={cn(classes.common, restProps.class)}>
    {#if isBackRequired}
        <button class="flex justify-start" onclick={() => window.history.back()}>
            <HugeiconsIcon size="5.5vw"  color="var(--color-black-700)" icon={ArrowLeft01Icon} />
        </button>
    {:else}
        <span aria-hidden="true"></span>
    {/if}
    <div class="flex flex-col items-start leading-}">
        <h3 class="">{title}</h3>
        {#if subtitle}
            <p class="text-black-700 mt-2">{subtitle}</p>
        {/if}
    </div>
    {#if showSettings}
    <Button.Action
        variant="soft"
        class="w-[72px] h-[72px] rounded-[24px] flex justify-center items-center mb-[2.3vh]"
        aria-label="Settings"
    >
    <!-- <Button.Nav></Button.Nav> -->
    </Button.Action>

        
        <button class="flex justify-end" onclick={handleProfile}>
            <HugeiconsIcon size="8.1vw" color="var(--color-black-700)" icon={Settings02Icon} />
        </button>
    {:else}
        <span aria-hidden="true"></span>
    {/if}
</header>
