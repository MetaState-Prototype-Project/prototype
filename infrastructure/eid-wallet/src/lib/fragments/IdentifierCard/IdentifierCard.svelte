<script lang="ts">
    import { goto } from "$app/navigation";
    import { ButtonAction } from "$lib/ui";
    import { cn } from "$lib/utils";
    import type { HTMLAttributes } from "svelte/elements";

    interface IIdentifierCard extends HTMLAttributes<HTMLElement> {
        eName: string, code: string
    }

    let {eName = "", code = "", ...restProps}:IIdentifierCard  = $props();

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            console.log("Copied to clipboard!");
        } catch (error) {
            console.error("Failed to copy:", error);
        }
    };

    const cBase = "relative w-full bg-black py-6 px-8 rounded-2xl";
</script>

<article {...restProps} class={cn(`${cBase}`, restProps.class)}>
    <img src="" alt="tick" class="" />
    <p class="text-sm font-normal text-gray-400">Your {eName}</p>
    <div class="grid grid-cols-[65%_35%] items-center gap-2">
        <h1 class="text-white text-sm font-medium break-all">{code}</h1>
        <ButtonAction callback={handleCopy} class="bg-white text-black z-[1]">Copy</ButtonAction>
    </div>
    <img class="absolute bottom-0 end-[30px]" src="/images/Line3.svg" alt="lines">
    <img class="absolute bottom-0 end-0" src="/images/Line4.svg" alt="lines">
</article>