<script lang="ts">
import { BottomSheet, PlatformAppCard } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import { untrack } from "svelte";
import type { RevealedVoteData } from "../scanLogic";

interface IRevealDrawerProps {
    isOpen: boolean;
    revealSuccess: boolean;
    revealedVoteData: RevealedVoteData | null;
    revealPollId: string | null;
    revealError: string | null;
    isRevealingVote: boolean;
    platform: string | null | undefined;
    hostname: string | null | undefined;
    onCancel: () => void;
    onReveal: () => void;
    onOpenChange: (value: boolean) => void;
}

const {
    isOpen,
    revealSuccess,
    revealedVoteData,
    revealPollId,
    revealError,
    isRevealingVote,
    platform,
    hostname,
    onCancel,
    onReveal,
    onOpenChange,
}: IRevealDrawerProps = $props();

let internalOpen = $state(untrack(() => isOpen));
let lastReportedOpen = $state(untrack(() => internalOpen));

$effect(() => {
    if (isOpen !== internalOpen) internalOpen = isOpen;
});

$effect(() => {
    if (internalOpen !== lastReportedOpen) {
        lastReportedOpen = internalOpen;
        onOpenChange?.(internalOpen);
    }
});
</script>

{#if internalOpen}
    <BottomSheet
        isOpen={internalOpen}
        dismissible={false}
        fullScreen={true}
        class="gap-5"
    >
        <div class="flex h-full w-full flex-col">
            {#if !revealSuccess}
                <div class="flex justify-end pt-2">
                    <button
                        type="button"
                        onclick={onCancel}
                        disabled={isRevealingVote}
                        aria-label="Close"
                        class="w-9 h-9 rounded-full bg-gray-100 text-black-700 flex items-center justify-center active:opacity-80 disabled:opacity-40"
                    >
                        <HugeiconsIcon
                            icon={Cancel01Icon}
                            size={18}
                            strokeWidth={2}
                        />
                    </button>
                </div>
            {/if}

            <div
                class="min-h-0 flex flex-1 flex-col items-center pt-4 gap-6"
            >
                {#if revealSuccess && revealedVoteData}
                    <div class="flex flex-col items-center gap-2 px-4">
                        <h4
                            class="text-2xl font-bold text-green-800 text-center leading-tight"
                        >
                            Vote decrypted
                        </h4>
                        <p class="text-sm leading-relaxed text-black-500 text-center">
                            Your selection has been successfully retrieved.
                        </p>
                    </div>

                    <PlatformAppCard
                        {hostname}
                        platformName={platform ?? hostname}
                    />

                    <div
                        class="bg-green-50 rounded-2xl p-6 border border-green-200 w-full text-left"
                    >
                        <p
                            class="text-xs font-semibold text-green-800 uppercase tracking-wider mb-2"
                        >
                            Selection
                        </p>
                        <p
                            class="text-2xl font-bold text-gray-900 leading-tight"
                        >
                            {revealedVoteData.chosenOption}
                        </p>
                        <div class="h-px bg-green-200 my-4"></div>
                        <p class="text-xs font-mono text-green-600 break-all">
                            Poll ID: {revealedVoteData.pollId}
                        </p>
                    </div>
                {:else}
                    <div class="flex flex-col items-center gap-2 px-4">
                        <h4
                            class="text-2xl font-bold text-black-900 text-center leading-tight"
                        >
                            You have scanned a<br />vote reveal QR code
                        </h4>
                        <p class="text-sm leading-relaxed text-black-500 text-center">
                            Please review the request from the following App.
                        </p>
                    </div>

                    <PlatformAppCard
                        {hostname}
                        platformName={platform ?? hostname}
                    />

                    <div
                        class="w-full border border-gray-100 rounded-2xl overflow-hidden bg-gray-50"
                    >
                        <table class="w-full border-collapse">
                            <tbody>
                                <tr>
                                    <td class="align-top py-4 px-4">
                                        <div
                                            class="text-xs font-semibold text-black-500 uppercase tracking-wider block"
                                        >
                                            Poll ID
                                        </div>
                                        <div
                                            class="text-sm text-black-700 font-mono font-medium truncate mt-1 block"
                                        >
                                            {revealPollId ?? "Unknown"}
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div
                        class="bg-blue-50 border border-blue-100 rounded-2xl p-4 w-full"
                    >
                        <p class="text-sm text-blue-800 leading-relaxed">
                            <strong>Note:</strong> This action will decrypt your
                            choice locally. This cannot be undone and will be visible
                            on this screen.
                        </p>
                    </div>

                    {#if revealError}
                        <div
                            class="bg-red-50 border border-red-200 rounded-2xl p-4 w-full"
                        >
                            <p class="text-sm text-red-800">{revealError}</p>
                        </div>
                    {/if}
                {/if}
            </div>

            <div class="shrink-0 flex w-full flex-col gap-3 pb-2 pt-6">
                {#if revealSuccess}
                    <Button.Action
                        variant="solid"
                        class="w-full"
                        callback={onCancel}
                    >
                        Okay
                    </Button.Action>
                {:else}
                    <div class="flex justify-center gap-3 items-center w-full">
                        <Button.Action
                            variant="soft"
                            class="w-full"
                            callback={onCancel}
                        >
                            Cancel
                        </Button.Action>
                        <Button.Action
                            variant="solid"
                            class="w-full whitespace-nowrap"
                            callback={onReveal}
                            disabled={isRevealingVote}
                        >
                            {isRevealingVote ? "Revealing..." : "Reveal"}
                        </Button.Action>
                    </div>
                {/if}
            </div>
        </div>
    </BottomSheet>
{/if}
