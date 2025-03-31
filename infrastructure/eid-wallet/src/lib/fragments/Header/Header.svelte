<script lang="ts">
import * as Button from "$lib/ui/Button";
import { cn } from "$lib/utils";
import { ArrowLeft01Icon, Settings02Icon } from "@hugeicons/core-free-icons";
import type { HTMLAttributes } from "svelte/elements";

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
const cBase = "w-full h-[9vh] flex justify-between items-center";
</script>
    
<header {...restProps} class={cn(cBase, restProps.class)}>
    {#if isBackRequired}
        <Button.Icon icon={ArrowLeft01Icon} iconSize="5.5vw" iconColor={"text-black-700"} onclick={() => window.history.back()} />
    {:else}
        <span aria-hidden="true"></span>
    {/if}
    <h3 class="text-center">{title}</h3>
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
    {/if}
</header>
    