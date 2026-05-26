<script lang="ts">
import ChevronIcon from "$lib/ui/icons/ChevronIcon.svelte";
import { cn } from "$lib/utils";
import type { HTMLAttributes } from "svelte/elements";
interface IHeroProps extends HTMLAttributes<HTMLElement> {
    title?: string;
    /** Optional secondary line under the title (e.g. "App Version 1.0.2"). */
    subtitle?: string;
    titleClasses?: string;
    /** Back-chevron color — used by /scan-qr where the nav sits on a dark
     *  camera surface. */
    iconColor?: string;
    /** Optional override for the back chevron. Defaults to window.history.back(). */
    onback?: () => void;
}
const {
    title,
    subtitle,
    titleClasses,
    iconColor,
    onback,
    ...restProps
}: IHeroProps = $props();

function handleBack() {
    if (onback) onback();
    else window.history.back();
}
const baseClasses = "w-full relative flex justify-center items-center py-2";
</script>

<nav {...restProps} class={cn(baseClasses, restProps.class)}>
    <button class="absolute left-0 top-2 p-4 bg-black-50 rounded-full"
        onclick={handleBack}
    >
        <ChevronIcon size={13} color={iconColor} />
    </button>
    <div class="flex flex-col items-center">
        <h4 class={cn(["text-2xl leading-tight", titleClasses])}>
            {title}
        </h4>
        <!-- Always rendered so the nav keeps a constant height. Pages
             without a subtitle pass undefined and we render an nbsp to
             reserve the line. Without this, navigating from a page with
             a subtitle (e.g. /settings) to one without (e.g. /settings/pin)
             would shift the content up. -->
        <p class="text-black-500 leading-tight mt-0.5">
            {subtitle ?? " "}
        </p>
    </div>
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
