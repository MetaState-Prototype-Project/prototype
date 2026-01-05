<script lang="ts">
    import * as Button from "$lib/ui/Button";
    import { QrCodeIcon } from "@hugeicons/core-free-icons";
    import { HugeiconsIcon } from "@hugeicons/svelte";
    import type { SigningData } from "../scanLogic";

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

    let hasPollDetails = false;
    $: hasPollDetails =
        signingData?.pollId !== undefined &&
        signingData?.pollDetails !== undefined;
</script>

<div
    class="flex flex-col gap-4 items-center justify-center w-full max-w-md mx-auto p-6 bg-white"
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

        <h4 class="text-green-800 text-xl font-bold text-center">
            {#if isBlindVotingRequest}
                Blind Vote Submitted Successfully!
            {:else if signingData?.pollId}
                Vote Signed Successfully!
            {:else}
                Message Signed Successfully!
            {/if}
        </h4>

        <p class="text-black-700 text-center text-sm">
            {#if isBlindVotingRequest}
                Your blind vote has been submitted and is now completely hidden
                using cryptographic commitments.
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
                You're being asked to submit a blind vote for the following poll
            {:else if signingData?.pollId}
                You're being asked to sign a vote for the following poll
            {:else}
                You're being asked to sign the following message
            {/if}
        </p>

        {#if signingData?.pollId && signingData?.voteData}
            <div class="bg-gray rounded-2xl w-full p-4 mt-4">
                <h4 class="text-sm text-black-700 font-semibold">Poll ID</h4>
                <p class="text-black-700 font-normal">
                    {signingData?.pollId ?? "Unknown"}
                </p>
            </div>
        {:else if isBlindVotingRequest && hasPollDetails}
            <div class="w-full mt-4">
                {#if blindVoteError}
                    <div
                        class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3 text-left"
                    >
                        <svg
                            class="h-5 w-5 text-red-400 mt-0.5"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fill-rule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                clip-rule="evenodd"
                            />
                        </svg>
                        <div>
                            <h3 class="text-sm font-medium text-red-800">
                                Error
                            </h3>
                            <div class="text-xs text-red-700">
                                {blindVoteError}
                            </div>
                        </div>
                    </div>
                {/if}

                <div class="bg-gray-50 rounded-xl p-4 mb-4 text-left">
                    <h4 class="font-bold text-gray-900 text-base">
                        {signingData?.pollDetails?.title || "Unknown Poll"}
                    </h4>
                    <p class="text-xs text-gray-600">
                        Creator: {signingData?.pollDetails?.creatorName ||
                            "Unknown"}
                    </p>
                </div>

                <fieldset class="mb-4 w-full text-left">
                    <legend class="block text-sm font-medium text-gray-700 mb-3"
                        >Select your vote:</legend
                    >
                    <div class="flex flex-col gap-2">
                        {#each signingData?.pollDetails?.options || [] as option, index}
                            <label
                                class="flex items-center p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
                            >
                                <input
                                    type="radio"
                                    name="blindVoteOption"
                                    value={index}
                                    checked={selectedBlindVoteOption === index}
                                    onchange={() =>
                                        onBlindVoteOptionChange(index)}
                                    class="w-4 h-4 text-blue-600"
                                />
                                <span class="ml-3 text-sm text-gray-700"
                                    >{option}</span
                                >
                            </label>
                        {/each}
                    </div>
                </fieldset>

                <Button.Action
                    variant="solid"
                    class="w-full"
                    disabled={selectedBlindVoteOption === null ||
                        isSubmittingBlindVote}
                    callback={onSubmitBlindVote}
                >
                    {#if isSubmittingBlindVote}
                        Submitting...
                    {:else}
                        Submit Blind Vote
                    {/if}
                </Button.Action>
            </div>
        {:else}
            <div class="bg-gray rounded-2xl w-full p-4 mt-4 text-left">
                <h4 class="text-sm text-black-700 font-semibold">Message</h4>
                <p class="text-black-700 font-normal break-words">
                    {signingData?.message ?? "No message provided"}
                </p>
            </div>

            <div class="bg-gray rounded-2xl w-full p-4 text-left">
                <h4 class="text-sm text-black-700 font-semibold">Session ID</h4>
                <p class="text-black-700 font-normal font-mono text-xs">
                    {signingData?.sessionId?.slice(0, 8) ?? "Unknown"}...
                </p>
            </div>

            {#if signingError}
                <div
                    class="bg-red-50 border border-red-200 rounded-lg p-4 mt-4 w-full flex items-start gap-3 text-left"
                >
                    <svg
                        class="h-5 w-5 text-red-400 mt-0.5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path
                            fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clip-rule="evenodd"
                        />
                    </svg>
                    <div>
                        <h3 class="text-sm font-medium text-red-800">Error</h3>
                        <div class="text-xs text-red-700">{signingError}</div>
                    </div>
                </div>
            {/if}
        {/if}

        <div class="flex justify-center gap-3 items-center mt-4 w-full">
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
                        disabled={loading}
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
</div>
