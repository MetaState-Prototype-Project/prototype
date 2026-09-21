<script lang="ts">
import { m } from "$lib/paraglide/messages";
import { BottomSheet, PlatformAppCard } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import { untrack } from "svelte";
import type { SigningData } from "../scanLogic";

interface ISigningDrawerProps {
    isOpen: boolean;
    showSigningSuccess: boolean;
    isBlindVotingRequest: boolean;
    signingData: SigningData | null;
    blindVoteError: string | null;
    selectedBlindVoteOption: number | null;
    isSubmittingBlindVote: boolean;
    loading: boolean;
    signingError: string | null | undefined;
    platform: string | null | undefined;
    hostname: string | null | undefined;
    onDecline: () => void;
    onSign: () => void;
    onBlindVoteOptionChange: (value: number) => void;
    onSubmitBlindVote: () => void;
    onSuccessOkay: () => void;
    onOpenChange: (value: boolean) => void;
}

const {
    isOpen,
    showSigningSuccess,
    isBlindVotingRequest,
    signingData,
    blindVoteError,
    selectedBlindVoteOption,
    isSubmittingBlindVote,
    loading,
    signingError,
    platform,
    hostname,
    onDecline,
    onSign,
    onBlindVoteOptionChange,
    onSubmitBlindVote,
    onSuccessOkay,
    onOpenChange,
}: ISigningDrawerProps = $props();

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

const hasPollDetails = $derived(
    signingData?.pollId !== undefined && signingData?.pollDetails !== undefined,
);

const title = $derived(
    showSigningSuccess
        ? isBlindVotingRequest
            ? m.signing_blind_vote_submitted()
            : signingData?.pollId
              ? m.signing_vote_signed()
              : m.signing_message_signed()
        : isBlindVotingRequest
          ? m.signing_scanned_blind_vote()
          : signingData?.pollId
            ? m.signing_scanned_vote()
            : m.signing_scanned_message(),
);

const subtitle = $derived(
    showSigningSuccess
        ? m.signing_success_subtitle()
        : m.signing_review_subtitle(),
);
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
            {#if !showSigningSuccess}
                <div class="flex justify-end pt-2">
                    <button
                        type="button"
                        onclick={onDecline}
                        disabled={loading}
                        aria-label={m.common_close()}
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
                <div class="flex flex-col items-center gap-2 px-4">
                    <h4
                        id="signing-title"
                        class="text-2xl font-bold text-center leading-tight {showSigningSuccess
                            ? 'text-green-800'
                            : 'text-black-900'}"
                    >
                        {title}
                    </h4>
                    <p class="text-sm leading-relaxed text-black-500 text-center">
                        {subtitle}
                    </p>
                </div>

                <PlatformAppCard
                    {hostname}
                    platformName={platform ?? hostname}
                />

                {#if signingData?.pollId || signingData?.message || (isBlindVotingRequest && hasPollDetails)}
                    <div
                        class="w-full border border-gray-100 rounded-2xl overflow-hidden bg-gray-50"
                    >
                        <table class="w-full border-collapse">
                            <tbody class="divide-y divide-gray-200">
                                {#if signingData?.pollId}
                                    <tr>
                                        <td class="align-top py-3 px-4">
                                            <div
                                                class="text-xs font-semibold text-black-500 uppercase tracking-wider block"
                                            >
                                                {m.vote_poll_id_label()}
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
                                                {m.signing_poll_title_label()}
                                            </div>
                                            <div
                                                class="text-sm text-black-700 font-medium mt-1 block"
                                            >
                                                {signingData?.pollDetails
                                                    ?.title}
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
                                                {m.signing_message_label()}
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
                                                {m.signing_session_id_label()}
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
                {/if}

                {#if !showSigningSuccess && isBlindVotingRequest && hasPollDetails}
                    <div class="w-full">
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
                                {m.signing_select_option()}
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
                                    <span class="text-sm text-black-700"
                                        >{option}</span
                                    >
                                </label>
                            {/each}
                        </fieldset>
                    </div>
                {/if}

                {#if signingError}
                    <div
                        class="bg-red-50 border border-red-200 rounded-2xl p-4 w-full text-sm text-red-700"
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
                        callback={onSuccessOkay}>{m.common_okay()}</Button.Action
                    >
                {:else if isBlindVotingRequest && hasPollDetails}
                    <Button.Action
                        variant="solid"
                        class="w-full"
                        callback={onSubmitBlindVote}
                        disabled={selectedBlindVoteOption === null ||
                            isSubmittingBlindVote}
                    >
                        {isSubmittingBlindVote
                            ? m.signing_submitting()
                            : m.signing_submit_blind_vote()}
                    </Button.Action>
                {:else}
                    <div class="flex justify-center gap-3 items-center w-full">
                        {#if signingError}
                            <Button.Action
                                variant="solid"
                                class="w-full"
                                callback={onDecline}>{m.common_okay()}</Button.Action
                            >
                        {:else}
                            <Button.Action
                                variant="soft"
                                class="w-full"
                                callback={onDecline}>{m.common_decline()}</Button.Action
                            >
                            <Button.Action
                                variant="solid"
                                class="w-full whitespace-nowrap"
                                callback={onSign}
                                disabled={loading}
                            >
                                {loading
                                    ? m.signing_signing()
                                    : signingData?.pollId
                                      ? m.signing_sign_vote()
                                      : m.signing_sign()}
                            </Button.Action>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    </BottomSheet>
{/if}
