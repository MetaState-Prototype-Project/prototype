<script lang="ts">
import ChevronIcon from "$lib/ui/icons/ChevronIcon.svelte";
import { cn } from "$lib/utils";
import type { HTMLAttributes } from "svelte/elements";
interface IHeroProps extends HTMLAttributes<HTMLElement> {
    title?: string;
    titleClasses?: string;
    iconColor?: string;
}
const {
    title,
    titleClasses,
    iconColor = "black",
    ...restProps
}: IHeroProps = $props();
const baseClasses = "w-full relative flex justify-center h-14 items-center";
</script>

<nav {...restProps} class={cn(baseClasses, restProps.class)}>
    <button class="absolute left-2 p-4 bg-black-50 rounded-full"
        onclick={() => window.history.back()}
    >
        <ChevronIcon size={13} />
    </button>
    <!-- <Button.Icon 
        icon={ArrowLeft01Icon}
        iconSize="sm"
        {iconColor}
        class="absolute left-2 p-2.75 bg-black-50 rounded-full"
        onclick={() => window.history.back()}
    /> -->
    <h4 class={cn(["text-2xl", titleClasses])}>
        {title}
    </h4>
</nav>

<!-- 
@component
@name AppNav
@description A component that displays the title of the current page and a back button.
@props
- title: string - The main title to display.
- titleClasses: string - Additional classes to apply to the title element.
@usage
```svelte
<AppNav title="My Title" />
 -->
