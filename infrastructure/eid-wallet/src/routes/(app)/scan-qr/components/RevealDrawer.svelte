<script lang="ts">
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

// Preserve original reactive sync for scanner logic hardware triggers
$: if (isOpen !== internalOpen) {
    internalOpen = isOpen;
}

$: if (internalOpen !== lastReportedOpen) {
    lastReportedOpen = internalOpen;
    onOpenChange?.(internalOpen);
}
</script>

{#if internalOpen}
    <div
        class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white p-4 text-center"
    >
        <div
            class="w-full max-w-md flex flex-col gap-4 items-center justify-center"
        >
            {#if revealSuccess && revealedVoteData}
                <div
                    class="bg-green-50 rounded-2xl p-6 border border-green-200 w-full mb-2 text-left"
                >
                    <p
                        class="text-sm font-medium text-green-800 uppercase tracking-wider mb-2"
                    >
                        Vote Decrypted
                    </p>
                    <p class="text-2xl font-bold text-gray-900 leading-tight">
                        You voted for: <br />
                        <span class="text-blue-600"
                            >{revealedVoteData.chosenOption}</span
                        >
                    </p>
                    <div class="h-px bg-green-200 my-4"></div>
                    <p class="text-xs font-mono text-green-600 break-all">
                        Poll ID: {revealedVoteData.pollId}
                    </p>
                </div>

                <div class="flex justify-center mt-4 w-full">
                    <Button.Action
                        variant="solid"
                        class="w-full"
                        callback={onCancel}
                    >
                        Okay
                    </Button.Action>
                </div>
            {:else}
                <div
                    class="flex justify-center mb-4 relative items-center overflow-hidden bg-gray rounded-xl p-4 h-[72px] w-[72px]"
                >
                    <div
                        class="bg-white h-[16px] w-[200px] -rotate-45 absolute top-1"
                    ></div>
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

                <h4 class="text-xl font-bold">Reveal Your Blind Vote</h4>
                <p class="text-gray-600 text-sm">
                    You're about to reveal your blind vote for poll: <br />
                    <span class="font-mono text-black font-semibold"
                        >{revealPollId}</span
                    >
                </p>

                <div
                    class="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-2 w-full text-left"
                >
                    <p class="text-sm text-blue-800 leading-relaxed">
                        <strong>Note:</strong> This action will decrypt your choice
                        locally. This cannot be undone and will be visible on this
                        screen.
                    </p>
                </div>

                {#if revealError}
                    <div
                        class="bg-red-50 border border-red-200 rounded-xl p-4 mt-2 w-full"
                    >
                        <p class="text-sm text-red-800">
                            {revealError}
                        </p>
                    </div>
                {/if}

                <div class="flex justify-center gap-3 items-center mt-6 w-full">
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
        </div>
    </div>
{/if}
