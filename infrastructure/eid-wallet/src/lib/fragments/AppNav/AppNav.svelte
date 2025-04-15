<script lang="ts">
import * as Button from "$lib/ui/Button";
import { cn } from "$lib/utils";
import { ArrowLeft01Icon, Settings02Icon } from "@hugeicons/core-free-icons";
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
    <Button.Icon 
        icon={ArrowLeft01Icon}
        iconSize="md"
        {iconColor}
        class="absolute left-2"
        onclick={() => window.history.back()}
    />
    <h4 class={cn(titleClasses)}>
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