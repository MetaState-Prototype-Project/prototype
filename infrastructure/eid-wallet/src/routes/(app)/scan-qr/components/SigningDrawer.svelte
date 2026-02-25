<script lang="ts">
import { BottomSheet } from "$lib/ui";
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

{#if internalOpen}
    <BottomSheet
        isOpen={internalOpen}
        dismissible={false}
        fullScreen={true}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signing-title"
        class="gap-5"
    >
        <div class="flex h-full w-full flex-col">
            <div class="min-h-0 flex flex-1 flex-col items-start overflow-y-auto pt-2">
                <div
                    class="flex justify-center mb-4 relative items-center overflow-hidden {showSigningSuccess
                        ? 'bg-green-100'
                        : 'bg-gray-50'} rounded-xl p-4 h-[72px] w-[72px]"
                >
                    <div
                        class="{showSigningSuccess
                            ? 'bg-green-500'
                            : 'bg-white'} h-4 w-[200px] -rotate-45 absolute top-1"
                    ></div>
                    <div
                        class="{showSigningSuccess
                            ? 'bg-green-500'
                            : 'bg-white'} h-4 w-[200px] -rotate-45 absolute bottom-1"
                    ></div>
                    <HugeiconsIcon
                        size={40}
                        className="z-10"
                        icon={QrCodeIcon}
                        strokeWidth={1.5}
                        color={showSigningSuccess
                            ? "var(--color-success)"
                            : "var(--color-primary)"}
                    />
                </div>

                <h4
                    id="signing-title"
                    class="text-lg font-bold {showSigningSuccess
                        ? 'text-green-800'
                        : ''}"
                >
                    {#if showSigningSuccess}
                        {isBlindVotingRequest
                            ? "Blind Vote Submitted!"
                            : signingData?.pollId
                              ? "Vote Signed!"
                              : "Message Signed!"}
                    {:else}
                        {isBlindVotingRequest
                            ? "Blind Vote Request"
                            : signingData?.pollId
                              ? "Sign Vote Request"
                              : "Sign Message Request"}
                    {/if}
                </h4>

                <p class="mt-1 text-sm leading-relaxed text-black-700">
                    {#if showSigningSuccess}
                        Your request was processed successfully.
                    {:else}
                        Please review the details below before proceeding.
                    {/if}
                </p>

                <div
                    class="w-full mt-6 border border-gray-100 rounded-2xl overflow-hidden bg-gray-50"
                >
                    <table class="w-full border-collapse">
                        <tbody class="divide-y divide-gray-200">
                            {#if signingData?.pollId}
                                <tr>
                                    <td class="align-top py-3 px-4">
                                        <div
                                            class="text-xs font-semibold text-black-500 uppercase tracking-wider block"
                                        >
                                            Poll ID
                                        </div>
                                        <div
                                            class="text-sm text-black-700 font-medium break-all mt-1 block"
                                        >
                                            {signingData.pollId}
                                        </div>
                                    </td>
                                </tr>
                            {/if}

                            {#if isBlindVotingRequest && hasPollDetails}
                                <tr>
                                    <td class="align-top py-3 px-4">
                                        <div
                                            class="text-xs font-semibold text-black-500 uppercase tracking-wider block"
                                        >
                                            Poll Title
                                        </div>
                                        <div
                                            class="text-sm text-black-700 font-medium mt-1 block"
                                        >
                                            {signingData?.pollDetails?.title}
                                        </div>
                                    </td>
                                </tr>
                            {/if}

                            {#if signingData?.message && !signingData?.pollId}
                                <tr>
                                    <td class="align-top py-3 px-4">
                                        <div
                                            class="text-xs font-semibold text-black-500 uppercase tracking-wider block"
                                        >
                                            Message
                                        </div>
                                        <div
                                            class="text-sm text-black-700 font-medium break-all mt-1 block"
                                        >
                                            {signingData.message}
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="align-top py-3 px-4">
                                        <div
                                            class="text-xs font-semibold text-black-500 uppercase tracking-wider block"
                                        >
                                            Session Id
                                        </div>
                                        <div
                                            class="text-sm text-black-700 font-medium break-all mt-1 block"
                                        >
                                            {signingData?.sessionId}
                                        </div>
                                    </td>
                                </tr>
                            {/if}
                        </tbody>
                    </table>
                </div>

                {#if !showSigningSuccess && isBlindVotingRequest && hasPollDetails}
                    <div class="w-full mt-4">
                        {#if blindVoteError}
                            <div
                                class="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-xs text-red-700"
                            >
                                {blindVoteError}
                            </div>
                        {/if}
                        <fieldset class="space-y-2">
                            <legend
                                class="text-xs font-semibold text-black-500 uppercase mb-2 ml-1"
                            >
                                Select Option
                            </legend>
                            {#each signingData?.pollDetails?.options || [] as option, index}
                                <label
                                class="flex items-center p-3 bg-white rounded-xl border border-gray-100 cursor-pointer"
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
                                    <span class="text-sm text-black-700">{option}</span>
                                </label>
                            {/each}
                        </fieldset>
                    </div>
                {/if}

                {#if signingError}
                    <div
                        class="bg-red-50 border border-red-200 rounded-lg p-4 mt-4 w-full text-sm text-red-700"
                    >
                        {signingError}
                    </div>
                {/if}
            </div>

            <div class="shrink-0 flex w-full flex-col gap-3 pb-2 pt-6">
                {#if showSigningSuccess}
                    <Button.Action
                        variant="solid"
                        class="w-full"
                        callback={onSuccessOkay}>Okay</Button.Action
                    >
                {:else if isBlindVotingRequest && hasPollDetails}
                    <Button.Action
                        variant="solid"
                        class="w-full"
                        callback={onSubmitBlindVote}
                        disabled={selectedBlindVoteOption === null || isSubmittingBlindVote}
                    >
                        {isSubmittingBlindVote
                            ? "Submitting..."
                            : "Submit Blind Vote"}
                    </Button.Action>
                {:else}
                    <div class="flex justify-center gap-3 items-center w-full">
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
                                class="w-full whitespace-nowrap"
                                callback={onSign}
                                disabled={loading}
                            >
                                {loading
                                    ? "Signing..."
                                    : signingData?.pollId
                                      ? "Sign Vote"
                                      : "Sign"}
                            </Button.Action>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    </BottomSheet>
{/if}
