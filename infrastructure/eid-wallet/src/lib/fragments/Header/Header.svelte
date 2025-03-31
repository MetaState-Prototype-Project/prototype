<script lang="ts">
import * as Button from "$lib/ui/Button";
import { cn } from "$lib/utils";
import { ArrowLeft01Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
import type { HTMLAttributes } from "svelte/elements";

interface IHeaderProps extends HTMLAttributes<HTMLElement> {
	title: string;
	isUserLoggedIn?: boolean;
	isBackRequired?: boolean;
	handleProfile?: () => void;
}

const {
	title = "Create PIN",
	isUserLoggedIn = true,
	isBackRequired = true,
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
    {#if isUserLoggedIn}
        <Button.Icon icon={UserCircleIcon} iconSize="8.1vw" iconColor={"text-black-700"} onclick={handleProfile} />
    {:else}
        <span aria-hidden="true"></span>
    {/if}
</header>