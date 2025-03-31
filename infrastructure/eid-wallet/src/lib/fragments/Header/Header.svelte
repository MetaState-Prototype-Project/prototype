<script lang="ts">
import { cn } from "$lib/utils";
import { ArrowLeft01Icon, Settings02Icon } from "@hugeicons/core-free-icons";
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
        <Button.Icon icon={ArrowLeft01Icon} iconSize="5.5vw" iconColor={"text-black-700"} onclick={() => window.history.back()} />
    {:else}
        <span aria-hidden="true"></span>
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

        
    {:else}
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
    {/if}
</header>
    