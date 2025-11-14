<script lang="ts">
import { Drawer } from "$lib/ui";
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

<Drawer
    title={showSigningSuccess
        ? "Success"
        : isBlindVotingRequest
          ? "Blind Vote"
          : signingData?.pollId
            ? "Sign Vote"
            : "Sign Message"}
    bind:isPaneOpen={internalOpen}
    class="flex flex-col gap-4 items-center justify-center"
>
    {#if showSigningSuccess}
        <div
            class="flex justify-center mb-4 relative items-center overflow-hidden bg-green-100 rounded-xl p-4 h-[72px] w-[72px]"
        >
            <div class="bg-green-500 h-[16px] w-[200px] -rotate-45 absolute top-1"></div>
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

        <h4 class="text-green-800">
            {#if isBlindVotingRequest}
                Blind Vote Submitted Successfully!
            {:else if signingData?.pollId}
                Vote Signed Successfully!
            {:else}
                Message Signed Successfully!
            {/if}
        </h4>
        <p class="text-black-700 text-center">
            {#if isBlindVotingRequest}
                Your blind vote has been submitted and is now completely hidden using
                cryptographic commitments.
            {:else if signingData?.pollId}
                Your vote has been signed and submitted to the voting system.
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

        <h4>
            {#if isBlindVotingRequest}
                Blind Vote Request
            {:else if signingData?.pollId}
                Sign Vote Request
            {:else}
                Sign Message Request
            {/if}
        </h4>
        <p class="text-black-700">
            {#if isBlindVotingRequest}
                You're being asked to submit a blind vote for the following poll
            {:else if signingData?.pollId}
                You're being asked to sign a vote for the following poll
            {:else}
                You're being asked to sign the following message
            {/if}
        </p>

        {#if signingData?.pollId && signingData?.voteData}
            <div class="bg-gray rounded-2xl w-full p-4 mt-4">
                <h4 class="text-base text-black-700">Poll ID</h4>
                <p class="text-black-700 font-normal">
                    {signingData?.pollId ?? "Unknown"}
                </p>
            </div>
        {:else if isBlindVotingRequest && hasPollDetails}
            <div class="blind-voting-section">
                <h3 class="text-lg font-semibold mb-4">Blind Voting</h3>

                {#if blindVoteError}
                    <div
                        class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4"
                    >
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <svg
                                    class="h-5 w-5 text-red-400"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fill-rule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                        clip-rule="evenodd"
                                    />
                                </svg>
                            </div>
                            <div class="ml-3">
                                <h3 class="text-sm font-medium text-red-800">
                                    Error
                                </h3>
                                <div class="mt-2 text-sm text-red-700">
                                    {blindVoteError}
                                </div>
                            </div>
                        </div>
                    </div>
                {/if}

                <div class="bg-gray-50 rounded-lg p-4 mb-4">
                    <h4 class="font-medium text-gray-900 mb-2">
                        Poll: {signingData?.pollDetails?.title || "Unknown"}
                    </h4>
                    <p class="text-sm text-gray-600">
                        Creator: {signingData?.pollDetails?.creatorName ||
                            "Unknown"}
                    </p>
                </div>

                <fieldset class="mb-4">
                    <legend class="block text-sm font-medium text-gray-700 mb-2">
                        Select your vote:
                    </legend>
                    {#each signingData?.pollDetails?.options || [] as option, index}
                        <label class="flex items-center mb-2">
                            <input
                                type="radio"
                                name="blindVoteOption"
                                value={index}
                                checked={selectedBlindVoteOption === index}
                                onchange={() => onBlindVoteOptionChange(index)}
                                class="mr-2"
                            />
                            <span class="text-sm">{option}</span>
                        </label>
                    {/each}
                </fieldset>

                <button
                    onclick={onSubmitBlindVote}
                    disabled={selectedBlindVoteOption === null ||
                        isSubmittingBlindVote}
                    class="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {#if isSubmittingBlindVote}
                        <span class="flex items-center justify-center">
                            <svg
                                class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                    class="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    stroke-width="4"
                                ></circle>
                                <path
                                    class="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                            </svg>
                            Submitting...
                        </span>
                    {:else}
                        Submit Blind Vote
                    {/if}
                </button>
            </div>
        {:else}
            <div class="bg-gray rounded-2xl w-full p-4 mt-4">
                <h4 class="text-base text-black-700">Message</h4>
                <p class="text-black-700 font-normal">
                    {signingData?.message ?? "No message provided"}
                </p>
            </div>

            <div class="bg-gray rounded-2xl w-full p-4">
                <h4 class="text-base text-black-700">Session ID</h4>
                <p class="text-black-700 font-normal font-mono">
                    {signingData?.sessionId?.slice(0, 8) ?? "Unknown"}...
                </p>
            </div>

            {#if signingError}
                <div class="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <svg
                                class="h-5 w-5 text-red-400"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path
                                    fill-rule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                    clip-rule="evenodd"
                                />
                            </svg>
                        </div>
                        <div class="ml-3">
                            <h3 class="text-sm font-medium text-red-800">Error</h3>
                            <div class="mt-2 text-sm text-red-700">
                                {signingError}
                            </div>
                        </div>
                    </div>
                </div>
            {/if}
        {/if}

        <div class="flex justify-center gap-3 items-center mt-4">
            {#if !isBlindVotingRequest}
                {#if signingError}
                    <Button.Action
                        variant="solid"
                        class="w-full"
                        callback={onDecline}
                    >
                        Okay
                    </Button.Action>
                {:else}
                    <Button.Action
                        variant="danger-soft"
                        class="w-full"
                        callback={onDecline}
                    >
                        Decline
                    </Button.Action>
                    <Button.Action
                        variant="solid"
                        class="w-full"
                        callback={onSign}
                    >
                        {#if loading}
                            Signing...
                        {:else if signingData?.pollId}
                            Sign Vote
                        {:else}
                            Sign Message
                        {/if}
                    </Button.Action>
                {/if}
            {/if}
        </div>
    {/if}
</Drawer>

