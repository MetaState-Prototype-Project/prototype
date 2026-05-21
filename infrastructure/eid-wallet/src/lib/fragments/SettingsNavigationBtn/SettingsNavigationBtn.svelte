<script lang="ts">
import { ChevronIcon } from "$lib/ui/icons";
import { cn } from "$lib/utils";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/svelte";
import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";

interface ISettingsNavigationBtn extends HTMLAttributes<HTMLElement> {
    /** Hugeicons icon to render inside the leading square. Ignored when
     *  `iconSlot` is provided. */
    icon?: IconSvgElement;
    /** Custom content for the leading square (used by Language to show a
     *  flag instead of an icon). */
    iconSlot?: Snippet;
    label: string;
    /** Optional second line under the label (e.g. "English", "External link"). */
    subtitle?: string;
    href?: string;
    onclick?: (event: MouseEvent) => void;
}

const {
    icon,
    iconSlot,
    label,
    subtitle,
    href,
    onclick,
    ...restProps
}: ISettingsNavigationBtn = $props();

const TagName = $derived(href ? "a" : "button");
</script>

<svelte:element
    this={TagName}
    href={href ?? undefined}
    type={TagName === "button" ? "button" : undefined}
    {onclick}
    {...restProps}
    class={cn(
        "w-full flex items-center gap-3 active:opacity-70 text-left",
        restProps.class,
    )}
>
    <div
        class="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-card overflow-hidden"
    >
        {#if iconSlot}
            {@render iconSlot()}
        {:else if icon}
            <HugeiconsIcon
                {icon}
                size={24}
                color="var(--color-black-900)"
                strokeWidth={2}
            />
        {/if}
    </div>
    <div class="flex-1 min-w-0">
        <p class="font-medium text-black-700 text-lg leading-tight">{label}</p>
        {#if subtitle}
            <p class="text-black-500 leading-tight">{subtitle}</p>
        {/if}
    </div>
    <ChevronIcon size={14} class="rotate-180 text-black shrink-0 mr-2" />
</svelte:element>
