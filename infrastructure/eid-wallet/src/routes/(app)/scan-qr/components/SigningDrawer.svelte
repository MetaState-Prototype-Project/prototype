<script lang="ts">
import * as Button from "$lib/ui/Button";
import { QrCodeIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import type { SigningData } from "../scanLogic";

export let isOpen: boolean;
export let showSigningSuccess: boolean;
export let isBlindVotingRequest: boolean;
export let signingData: SigningData | null;
export let blindVoteError: string | null;
export let selectedBlindVoteOption: number | null;
export let isSubmittingBlindVote: boolean;
export let loading: boolean;
export let signingError: string | null | undefined;
export let onDecline: () => void;
export let onSign: () => void;
export let onBlindVoteOptionChange: (value: number) => void;
export let onSubmitBlindVote: () => void;
export let onSuccessOkay: () => void;
export let onOpenChange: (value: boolean) => void;

let internalOpen = isOpen;
let lastReportedOpen = internalOpen;

// Preserve original reactive sync for scanner logic
$: if (isOpen !== internalOpen) {
    internalOpen = isOpen;
}

$: if (internalOpen !== lastReportedOpen) {
    lastReportedOpen = internalOpen;
    onOpenChange?.(internalOpen);
}

let hasPollDetails = false;
$: hasPollDetails =
    signingData?.pollId !== undefined && signingData?.pollDetails !== undefined;
</script>

{#if internalOpen}
    <div
        class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white p-4 overflow-y-auto"
    >
        <div
            class="w-full max-w-md flex flex-col gap-4 items-center justify-center py-8"
        >
            {#if showSigningSuccess}
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

                <h4 class="text-green-800 text-xl font-bold">
                    {#if isBlindVotingRequest}
                        Blind Vote Submitted!
                    {:else if signingData?.pollId}
                        Vote Signed!
                    {:else}
                        Message Signed!
                    {/if}
                </h4>
                <p class="text-black-700 text-center text-sm">
                    {#if isBlindVotingRequest}
                        Your blind vote has been submitted and is now completely
                        hidden using cryptographic commitments.
                    {:else if signingData?.pollId}
                        Your vote has been signed and submitted to the voting
                        system.
                    {:else}
                        Your message has been signed and submitted successfully.
                    {/if}
                </p>

                <div class="flex justify-center mt-6 w-full">
                    <Button.Action
                        variant="solid"
                        class="w-full"
                        callback={onSuccessOkay}
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

                <h4 class="text-xl font-bold">
                    {#if isBlindVotingRequest}
                        Blind Vote Request
                    {:else if signingData?.pollId}
                        Sign Vote Request
                    {:else}
                        Sign Message Request
                    {/if}
                </h4>
                <p class="text-black-700 text-center text-sm">
                    {#if isBlindVotingRequest}
                        You're being asked to submit a blind vote for the
                        following poll
                    {:else if signingData?.pollId}
                        You're being asked to sign a vote for the following poll
                    {:else}
                        You're being asked to sign the following message
                    {/if}
                </p>

                {#if signingData?.pollId && signingData?.voteData}
                    <div class="bg-gray rounded-2xl w-full p-4 mt-2">
                        <h4
                            class="text-xs font-semibold text-gray-500 uppercase"
                        >
                            Poll ID
                        </h4>
                        <p class="text-black-700 font-medium">
                            {signingData?.pollId ?? "Unknown"}
                        </p>
                    </div>
                {:else if isBlindVotingRequest && hasPollDetails}
                    <div class="w-full bg-gray rounded-2xl p-4 mt-2">
                        <h3 class="text-sm font-bold mb-3">
                            Poll: {signingData?.pollDetails?.title || "Unknown"}
                        </h3>

                        {#if blindVoteError}
                            <div
                                class="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-xs text-red-700"
                            >
                                {blindVoteError}
                            </div>
                        {/if}

                        <fieldset class="space-y-2">
                            {#each signingData?.pollDetails?.options || [] as option, index}
                                <label
                                    class="flex items-center p-3 bg-white rounded-xl border border-gray-100 shadow-sm cursor-pointer"
                                >
                                    <input
                                        type="radio"
                                        name="blindVoteOption"
                                        value={index}
                                        checked={selectedBlindVoteOption ===
                                            index}
                                        onchange={() =>
                                            onBlindVoteOptionChange(index)}
                                        class="mr-3 h-4 w-4"
                                    />
                                    <span class="text-sm">{option}</span>
                                </label>
                            {/each}
                        </fieldset>

                        <button
                            onclick={onSubmitBlindVote}
                            disabled={selectedBlindVoteOption === null ||
                                isSubmittingBlindVote}
                            class="w-full mt-4 bg-blue-600 text-white py-3 rounded-xl font-bold disabled:bg-gray-300 transition-colors"
                        >
                            {isSubmittingBlindVote
                                ? "Submitting..."
                                : "Submit Blind Vote"}
                        </button>
                    </div>
                {:else}
                    <div class="bg-gray rounded-2xl w-full p-4 mt-2">
                        <h4
                            class="text-xs font-semibold text-gray-500 uppercase"
                        >
                            Message
                        </h4>
                        <p class="text-black-700 font-medium break-all">
                            {signingData?.message ?? "No message provided"}
                        </p>
                    </div>
                {/if}

                {#if signingError}
                    <div
                        class="bg-red-50 border border-red-200 rounded-lg p-4 w-full text-sm text-red-700"
                    >
                        {signingError}
                    </div>
                {/if}

                <div class="flex justify-center gap-3 items-center mt-4 w-full">
                    {#if !isBlindVotingRequest}
                        {#if signingError}
                            <Button.Action
                                variant="solid"
                                class="w-full"
                                callback={onDecline}>Okay</Button.Action
                            >
                        {:else}
                            <Button.Action
                                variant="danger-soft"
                                class="w-full"
                                callback={onDecline}>Decline</Button.Action
                            >
                            <Button.Action
                                variant="solid"
                                class="w-full"
                                callback={onSign}
                                disabled={loading}
                            >
                                {loading
                                    ? "Signing..."
                                    : signingData?.pollId
                                      ? "Sign Vote"
                                      : "Sign Message"}
                            </Button.Action>
                        {/if}
                    {/if}
                </div>
            {/if}
        </div>
    </div>
{/if}
