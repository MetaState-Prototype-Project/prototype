<script lang="ts">
import { BottomSheet } from "$lib/ui";
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

{#if internalOpen}
    <BottomSheet
        isOpen={internalOpen}
        dismissible={false}
        fullScreen={true}
        class="gap-5"
    >
        <div class="flex h-full w-full flex-col">
            <div class="min-h-0 flex flex-1 flex-col items-start overflow-y-auto pt-2">
                <div
                    class="flex justify-center mb-4 relative items-center overflow-hidden {revealSuccess
                        ? 'bg-green-100'
                        : 'bg-gray'} rounded-xl p-4 h-[72px] w-[72px]"
                >
                    <div
                        class="{revealSuccess
                            ? 'bg-green-500'
                            : 'bg-white'} h-4 w-[200px] -rotate-45 absolute top-1"
                    ></div>
                    <div
                        class="{revealSuccess
                            ? 'bg-green-500'
                            : 'bg-white'} h-4 w-[200px] -rotate-45 absolute bottom-1"
                    ></div>
                    <HugeiconsIcon
                        size={40}
                        className="z-10"
                        icon={QrCodeIcon}
                        strokeWidth={1.5}
                        color={revealSuccess
                            ? "var(--color-success)"
                            : "var(--color-primary)"}
                    />
                </div>

                {#if revealSuccess && revealedVoteData}
                    <h4 class="text-xl font-bold text-green-800">
                        Vote Decrypted
                    </h4>
                    <p class="text-black-700 mt-1">
                        Your selection has been successfully retrieved.
                    </p>

                    <div class="flex flex-col gap-4 py-6 w-full">
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
                            <p
                                class="text-xs font-mono text-green-600 break-all"
                            >
                                Poll ID: {revealedVoteData.pollId}
                            </p>
                        </div>
                    </div>
                {:else}
                    <h4 class="text-xl font-bold">Reveal Your Blind Vote</h4>
                    <p class="text-black-700 mt-1">
                        Please review the request details below.
                    </p>

                    <div class="flex flex-col gap-4 py-6 w-full">
                        <div
                            class="w-full border border-gray-100 rounded-2xl overflow-hidden bg-gray-50"
                        >
                            <table class="w-full border-collapse">
                                <tbody class="divide-y divide-gray-200">
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
                            class="bg-blue-50 border border-blue-100 rounded-xl p-4 w-full"
                        >
                            <p class="text-sm text-blue-800 leading-relaxed">
                                <strong>Note:</strong> This action will decrypt your
                                choice locally. This cannot be undone and will be
                                visible on this screen.
                            </p>
                        </div>

                        {#if revealError}
                            <div
                                class="bg-red-50 border border-red-200 rounded-xl p-4 w-full"
                            >
                                <p class="text-sm text-red-800">
                                    {revealError}
                                </p>
                            </div>
                        {/if}
                    </div>
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
                            variant="danger-soft"
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
