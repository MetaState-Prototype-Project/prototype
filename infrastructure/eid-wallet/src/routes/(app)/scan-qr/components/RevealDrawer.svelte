<script lang="ts">
import { Drawer } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import { QrCodeIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";

import type { RevealedVoteData } from "../scanLogic";

export let isOpen: boolean;
export let revealSuccess: boolean;
export let revealedVoteData: RevealedVoteData | null;
export let revealPollId: string | null;
export let revealError: string | null;
export let isRevealingVote: boolean;
export let onCancel: () => void;
export let onReveal: () => void;
export let onOpenChange: (value: boolean) => void;

let internalOpen = isOpen;
let lastReportedOpen = internalOpen;

$: if (isOpen !== internalOpen) {
    internalOpen = isOpen;
}

$: if (internalOpen !== lastReportedOpen) {
    lastReportedOpen = internalOpen;
    onOpenChange?.(internalOpen);
}
</script>

<Drawer
    title={revealSuccess ? "Vote Revealed" : "Reveal Blind Vote"}
    bind:isPaneOpen={internalOpen}
    class="flex flex-col gap-4 items-center justify-center"
>
    {#if revealSuccess && revealedVoteData}
        <div class="bg-white rounded-lg p-4 border border-green-200">
            <p class="text-lg font-semibold text-green-900">
                You voted for: <span class="text-blue-600"
                    >{revealedVoteData.chosenOption}</span
                >
            </p>
            <p class="text-sm text-green-600 mt-2">
                Poll ID: {revealedVoteData.pollId}
            </p>
        </div>

        <div class="flex justify-center mt-6 w-full">
            <Button.Action variant="solid" class="w-full" callback={onCancel}>
                Okay
            </Button.Action>
        </div>
    {:else}
        <div
            class="flex justify-center mb-4 relative items-center overflow-hidden bg-gray rounded-xl p-4 h-[72px] w-[72px]"
        >
            <div class="bg-white h-[16px] w-[200px] -rotate-45 absolute top-1"></div>
            <div
                class="bg-white h-[16px] w-[200px] -rotate-45 absolute bottom-1"
            ></div>
            <HugeiconsIcon
                size={40}
                className="z-10"
                icon={QrCodeIcon}
                strokeWidth={1.5}
                color="var(--color-primary)"
            />
        </div>

        <h4>Reveal Your Blind Vote</h4>
        <p class="text-black-700 text-center">
            You're about to reveal your blind vote for poll: {revealPollId}
        </p>

        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <p class="text-sm text-blue-800 text-center">
                <strong>Note:</strong> Revealing your vote will show your choice locally
                in this wallet. This action cannot be undone.
            </p>
        </div>

        {#if revealError}
            <div class="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                <p class="text-sm text-red-800 text-center">
                    {revealError}
                </p>
            </div>
        {/if}

        <div class="flex justify-center gap-3 items-center mt-4 w-full">
            <Button.Action
                variant="danger-soft"
                class="w-full"
                callback={onCancel}
            >
                Cancel
            </Button.Action>
            <Button.Action
                variant="solid"
                class="w-full"
                callback={onReveal}
                disabled={isRevealingVote}
            >
                {#if isRevealingVote}
                    Revealing...
                {:else}
                    Reveal Vote
                {/if}
            </Button.Action>
        </div>
    {/if}
</Drawer>

