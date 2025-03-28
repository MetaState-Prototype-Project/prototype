<script lang="ts">
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

let {
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
</script>

<div {...restProps} class="relative {variant === 'eName' ? "bg-black-900" : variant === 'ePassport' ? "bg-primary" : "bg-gray"}  rounded-xl w-full min-h-[150px] text-white overflow-hidden">
    <div class="w-full h-full pointer-events-none flex gap-13 justify-end absolute right-15 bottom-20">
        <div class="w-10 {variant === 'eVault' ? "bg-white/40" : "bg-white/10"} h-[300%] rotate-40"></div>
        <div class="w-10 {variant === 'eVault' ? "bg-white/40" : "bg-white/10"} h-[300%] rotate-40"></div>
    </div>
    <div class="p-5 flex flex-col gap-2">
        <div class="flex justify-between">
            {#if variant === 'eName'}  
                <HugeiconsIcon size={30} strokeWidth={2} color="var(--color-secondary)" icon={CheckmarkBadge02Icon} />
                <div class="flex gap-3 items-center"> 
                    <button class="flex justify-start" onclick={shareBtn}>
                        <HugeiconsIcon size={30} strokeWidth={2} color="white" icon={Upload03Icon} />
                    </button>
                    <button class="flex justify-start" onclick={viewBtn}>
                        <HugeiconsIcon size={30} strokeWidth={2} color="white" icon={ViewIcon} />
                    </button>
                </div>
            {:else if variant === 'ePassport'}
                <p class="bg-white flex items-center rounded-4xl px-5 py-2 small font-semibold">HIGH SECURITY</p>
                <button class="flex justify-start" onclick={viewBtn}>
                    <HugeiconsIcon size={30} strokeWidth={2} color="white" icon={ViewIcon} />
                </button>
            {:else if variant === 'eVault'}
            <h3 class="text-black-300 font-semibold mb-3">{state.progressWidth} Used</h3>
            {/if}
        </div>
        <div>
            {#if variant === "eName"}        
                <p class="text-gray font-light">Your eName</p>
                <div class="flex items-center justify-between w-full">
                    <p class="text-white w-[60%] font-medium">@{userId}</p>
                </div>
            {:else if variant === "ePassport"}
                <div class="flex gap-2 flex-col">
                    {#if userData}
                        {#each Object.entries(userData) as [fieldName, value] }    
                            <div class="flex justify-between">
                                <p class="text-gray">{fieldName}</p>
                                <p class=" font-medium text-white">{value}</p>
                            </div>
                        {/each}
                    {/if}
                </div>
            {:else if variant === "eVault"}
            <div>
                <div class="flex justify-between mb-1 ">
                    <p class="z-[1]">{usedStorage}GB Used</p>
                    <p class="z-[1]">{totalStorage}GB Used</p>
                </div>
                <div class="relative w-full h-3 rounded-full overflow-hidden bg-primary-400">
                    <div class="h-full bg-secondary rounded-full" style={`width: calc(${state.progressWidth})`}></div>
                </div>
            </div>
            {/if}
        </div>
    </div>
</div>


