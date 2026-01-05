<script lang="ts">
import * as Button from "$lib/ui/Button";
import { QrCodeIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import type { RevealedVoteData } from "../scanLogic";

export let revealSuccess: boolean;
export let revealedVoteData: RevealedVoteData | null;
export let revealPollId: string | null;
export let revealError: string | null;
export let isRevealingVote: boolean;
export let onCancel: () => void;
export let onReveal: () => void;
</script>

<div
    class="flex flex-col gap-4 items-center justify-center w-full max-w-md mx-auto p-6 bg-white text-center"
>
    {#if revealSuccess && revealedVoteData}
        <div
            class="flex justify-center mb-4 relative items-center overflow-hidden bg-green-100 rounded-xl p-4 h-[72px] w-[72px]"
        >
            <div
                class="bg-green-500 h-[16px] w-[200px] -rotate-45 absolute top-1"
            ></div>
            <div
                class="bg-green-500 h-[16px] w-[200px] -rotate-45 absolute bottom-1"
            ></div>
            <HugeiconsIcon
                size={40}
                className="z-10"
                icon={QrCodeIcon}
                strokeWidth={1.5}
                color="var(--color-success)"
            />
        </div>

        <h4 class="text-xl font-bold">Vote Revealed</h4>

        <div class="bg-gray-50 rounded-2xl p-6 border border-green-200 w-full">
            <p class="text-lg font-semibold text-gray-900">
                You voted for: <br />
                <span class="text-primary text-2xl font-bold capitalize">
                    {revealedVoteData.chosenOption}
                </span>
            </p>
            <p class="text-xs text-gray-500 mt-4 font-mono">
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
        <p class="text-black-700">
            You're about to reveal your blind vote for poll: <br />
            <span class="font-mono text-sm">{revealPollId}</span>
        </p>

        <div class="bg-blue-50 border border-blue-200 rounded-2xl p-4 mt-2">
            <p class="text-sm text-blue-800">
                <strong>Note:</strong> This action cannot be undone. It will decrypt
                and show your choice locally in this wallet.
            </p>
        </div>

        {#if revealError}
            <div
                class="bg-red-50 border border-red-200 rounded-xl p-4 mt-4 w-full"
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
