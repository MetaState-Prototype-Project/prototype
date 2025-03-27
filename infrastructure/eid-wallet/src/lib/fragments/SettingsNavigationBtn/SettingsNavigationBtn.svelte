<script lang="ts">
import { cn } from "$lib/utils";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";

interface ISettingsNavigationBtn extends HTMLAttributes<HTMLElement> {
	icon: Snippet;
	label: string;
	onClick: () => void;
}

let { icon, label, onClick, ...restProps }: ISettingsNavigationBtn = $props();
</script>

<div {...restProps} class={cn('flex items-center justify-between px-3 py-2', restProps.class)} onclick={onClick}>
    <div class="flex items-center gap-2">
        <div class="p-3 bg-gray max-w-max rounded-4xl object-cover flex items-center" >
            {@render icon?.()}
        </div>
        <h1>{label}</h1>
    </div>
    <HugeiconsIcon size={30}  color="var(--color-black-500)" icon={ArrowRight01Icon} />
</div>