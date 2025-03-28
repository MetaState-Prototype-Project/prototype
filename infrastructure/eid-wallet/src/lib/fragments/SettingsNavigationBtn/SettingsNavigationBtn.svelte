<script lang="ts">
import * as Button from "$lib/ui/Button";
import { cn } from "$lib/utils";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/svelte";
import type { HTMLAttributes } from "svelte/elements";

interface ISettingsNavigationBtn extends HTMLAttributes<HTMLElement> {
	icon: IconSvgElement;
	label: string;
	href: string;
}

const { icon, label, href, ...restProps }: ISettingsNavigationBtn = $props();
</script>

<Button.Nav {href} {...restProps} class={cn('flex items-center justify-between px-3 py-2', restProps.class)}>
    <div class="flex items-center gap-2">
        <div class="p-3 bg-gray max-w-max rounded-full object-cover flex items-center" >
            <HugeiconsIcon {icon} size={30}  color="var(--color-black-500)" />
        </div>
        <p class="font-medium!">{label}</p>
    </div>
    <HugeiconsIcon size={30}  color="var(--color-black-500)" icon={ArrowRight01Icon} />
</Button.Nav>