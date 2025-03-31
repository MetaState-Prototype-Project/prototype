<script lang="ts">
import { cn } from "$lib/utils";
import { Settings02Icon } from "@hugeicons/core-free-icons";
import type { HTMLAttributes } from "svelte/elements";
import * as Button from "$lib/ui/Button";

interface IHeroProps extends HTMLAttributes<HTMLElement> {
	title?: string;
	subtitle?: string;
	showSettings?: boolean;
	titleClasses?: string;
}

const {
	title,
	subtitle,
	showSettings = false,
	titleClasses,
	children,
	...restProps
}: IHeroProps = $props();

const baseClasses = "w-full flex justify-between items-center";
</script>

<header {...restProps} class={cn(baseClasses, restProps.class)}>
    <div class="flex flex-col items-start">
            <h3 class={cn(titleClasses)}>
                {@render children?.()}
                {title}
            </h3>
        {#if subtitle}
            <p class="text-black-700 mt-2">{subtitle}</p>
        {/if}
    </div>
    {#if showSettings}
        <Button.Nav href="/settings">
            <Button.Icon
                icon={Settings02Icon}
                iconSize="lg"
            />
        </Button.Nav>
    {:else}
        <span aria-hidden="true"></span>
    {/if}
</header>