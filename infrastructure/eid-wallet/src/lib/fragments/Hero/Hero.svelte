<script lang="ts">
import * as Button from "$lib/ui/Button";
import { cn } from "$lib/utils";
import { Settings02Icon } from "@hugeicons/core-free-icons";
import type { HTMLAttributes } from "svelte/elements";

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

<!-- 
@component
@name Hero
@description A component that displays a header with a title, subtitle, and optional settings icon.
@props
- title: string - The main title to display.
- subtitle: string - An optional subtitle to display below the title.
- showSettings: boolean - A flag to determine if the settings icon should be displayed.
- titleClasses: string - Additional classes to apply to the title element.
- children: Snippet - Optional child elements to render within the title.
@slots
- default - Slot for additional content to be rendered within the title.
@usage
```svelte
<Hero
        title="Good morning!"
        subtitle="Don't forget to drink water."
        class="mb-8"
        titleClasses="-mb-2"
        showSettings
    >
</Hero>
```
 -->