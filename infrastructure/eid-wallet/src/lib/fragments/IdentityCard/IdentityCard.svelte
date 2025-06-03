<script lang="ts">
    import * as Button from "$lib/ui/Button";
    import { cn } from "$lib/utils";
    import {
        CheckmarkBadge02Icon,
        Upload03Icon,
        ViewIcon,
    } from "@hugeicons/core-free-icons";
    import { HugeiconsIcon } from "@hugeicons/svelte";
    import type { HTMLAttributes } from "svelte/elements";

    interface userData {
        [fieldName: string]: string;
    }
    interface IIdentityCard extends HTMLAttributes<HTMLElement> {
        variant?: "eName" | "ePassport" | "eVault";
        userId?: string;
        viewBtn?: () => void;
        shareBtn?: () => void;
        userData?: userData;
        totalStorage?: number;
        usedStorage?: number;
    }

    const {
        variant = "eName",
        userId,
        viewBtn,
        shareBtn,
        userData,
        totalStorage = 0,
        usedStorage = 0,
        ...restProps
    }: IIdentityCard = $props();
    const state = $state({
        progressWidth: "0%",
    });

    $effect(() => {
        state.progressWidth =
            usedStorage > 0 ? `${(usedStorage / totalStorage) * 100}%` : "0%";
    });

    const baseClasses = `relative ${variant === "eName" ? "bg-black-900" : variant === "ePassport" ? "bg-primary" : "bg-gray"}  rounded-3xl w-full min-h-[150px] text-white overflow-hidden`;
</script>

<div {...restProps} class={cn(baseClasses, restProps.class)}>
    <div
        class="w-full h-full pointer-events-none flex gap-13 justify-end absolute right-15 bottom-20"
    >
        <div
            class="w-10 {variant === 'eVault'
                ? 'bg-white/40'
                : 'bg-white/10'} h-[300%] rotate-40"
        ></div>
        <div
            class="w-10 {variant === 'eVault'
                ? 'bg-white/40'
                : 'bg-white/10'} h-[300%] rotate-40"
        ></div>
    </div>
    <div class="p-5 flex flex-col gap-2">
        <div class="flex justify-between">
            {#if variant === "eName"}
                <HugeiconsIcon
                    size={30}
                    strokeWidth={2}
                    className="text-secondary"
                    icon={CheckmarkBadge02Icon}
                />
                <div class="flex gap-3 items-center">
                    {#if shareBtn}
                        <Button.Icon
                            icon={Upload03Icon}
                            iconColor={"white"}
                            strokeWidth={2}
                            onclick={shareBtn}
                        />
                    {/if}
                    {#if viewBtn}
                        <Button.Icon
                            icon={ViewIcon}
                            iconColor={"white"}
                            strokeWidth={2}
                            onclick={viewBtn}
                        />
                    {/if}
                </div>
            {:else if variant === "ePassport"}
                <p
                    class="bg-white text-black flex items-center leading-0 justify-center rounded-full h-7 px-5 text-xs font-medium"
                >
                    HIGH SECURITY
                </p>
                {#if viewBtn}
                    <Button.Icon
                        icon={ViewIcon}
                        iconColor={"white"}
                        strokeWidth={2}
                        onclick={viewBtn}
                    />
                {/if}
            {:else if variant === "eVault"}
                <h3 class="text-black-300 text-3xl font-semibold mb-3 z-[1]">
                    {state.progressWidth} Used
                </h3>
            {/if}
        </div>
        <div>
            {#if variant === "eName"}
                <p class="text-gray font-normal">Your eName</p>
                <div class="flex items-center justify-between w-full">
                    <p class="text-white w-full font-medium">{userId}</p>
                </div>
            {:else if variant === "ePassport"}
                <div class="flex gap-2 flex-col">
                    {#if userData}
                        {#each Object.entries(userData) as [fieldName, value]}
                            <div class="flex justify-between">
                                <p class="text-gray capitalize">{fieldName}</p>
                                <p class=" font-medium text-white">{value}</p>
                            </div>
                        {/each}
                    {/if}
                </div>
            {:else if variant === "eVault"}
                <div>
                    <div class="flex justify-between mb-1">
                        <p class="z-[1]">{usedStorage}GB Used</p>
                        <p class="z-[1]">{totalStorage}GB total storage</p>
                    </div>
                    <div
                        class="relative w-full h-3 rounded-full overflow-hidden bg-primary-400"
                    >
                        <div
                            class="h-full bg-secondary rounded-full"
                            style={`width: calc(${state.progressWidth})`}
                        ></div>
                    </div>
                </div>
            {/if}
        </div>
    </div>
</div>

