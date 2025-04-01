<script lang="ts">
import * as Button from "$lib/ui/Button";
import { cn } from "$lib/utils";
import { ArrowLeft01Icon, Settings02Icon } from "@hugeicons/core-free-icons";
import type { HTMLAttributes } from "svelte/elements";
interface IHeroProps extends HTMLAttributes<HTMLElement> {
	title?: string;
	titleClasses?: string;
}
const { title, titleClasses, ...restProps }: IHeroProps = $props();
const baseClasses = "w-full relative flex justify-center h-14 items-center";
</script>
    
<nav {...restProps} class={cn(baseClasses, restProps.class)}>
    <Button.Icon 
        icon={ArrowLeft01Icon}
        iconSize="md"
        iconColor={"black"}
        class="absolute left-2"
        onclick={() => window.history.back()}
    />
    <h4 class={cn(titleClasses)}>
        {title}
    </h4>
</nav>