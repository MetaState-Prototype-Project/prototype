<script lang="ts">
    import { AppNav, IdentityCard } from "$lib/fragments";
    import type { GlobalState } from "$lib/global";
    import * as Button from "$lib/ui/Button";
    import { Share05Icon } from "@hugeicons/core-free-icons";
    import { HugeiconsIcon } from "@hugeicons/svelte";
    import { getContext, onMount } from "svelte";

    const globalState = getContext<() => GlobalState>("globalState")();

    function shareEPassport() {
        alert("EPassport Code shared!");
    }

    let userData: Record<string, unknown>;
    let docData: Record<string, unknown> = {};

    onMount(async () => {
        userData = await globalState.userController.user;
        docData = await globalState.userController.document;
        console.log(userData);
    });
</script>

<AppNav title="ePassport" class="mb-8" />

<div>
    {#if userData}
        <IdentityCard variant="ePassport" {userData} class="shadow-lg" />
    {/if}
    {#if docData}
        <div
            class="p-6 pt-12 bg-gray w-full rounded-2xl -mt-8 flex flex-col gap-2"
        >
            {#each Object.entries(docData) as [fieldName, value]}
                <div class="flex justify-between">
                    <p class="text-black-700 font-normal">{fieldName}</p>
                    <p class="text-black-500 font-medium">{value}</p>
                </div>
            {/each}
        </div>
    {/if}
</div>

