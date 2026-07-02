<script lang="ts">
import { BottomSheet, ContactCard } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import { untrack } from "svelte";

interface ISocialBindingDrawerProps {
    isOpen: boolean;
    requesterEname: string | null;
    requesterName: string | null;
    loading: boolean;
    error: string | null;
    success: boolean;
    relationDescription: string;
    onConfirm: () => void;
    onDecline: () => void;
    onOpenChange: (value: boolean) => void;
    onDescriptionChange: (value: string) => void;
}

const {
    isOpen,
    requesterEname,
    requesterName,
    loading,
    error,
    success,
    relationDescription,
    onConfirm,
    onDecline,
    onOpenChange,
    onDescriptionChange,
}: ISocialBindingDrawerProps = $props();

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
        role="dialog"
        aria-modal="true"
        aria-labelledby="social-binding-title"
        class="gap-5"
    >
        <div class="flex h-full w-full flex-col">
            {#if !success}
                <div class="flex justify-end pt-2">
                    <button
                        type="button"
                        onclick={onDecline}
                        disabled={loading}
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
                <div class="flex flex-col items-center gap-2 px-4">
                    <h4
                        id="social-binding-title"
                        class="text-2xl font-bold text-center leading-tight {success
                            ? 'text-green-800'
                            : 'text-black-900'}"
                    >
                        {success
                            ? "Request sent"
                            : "You have scanned a\nsocial binding QR code"}
                    </h4>
                    <p class="text-sm leading-relaxed text-black-500 text-center">
                        {#if success}
                            You've signed the social identity binding. The
                            counterparty will counter-sign to complete the
                            mutual binding.
                        {:else}
                            Please review the identity below before proceeding.
                        {/if}
                    </p>
                </div>

                <ContactCard
                    eName={requesterEname}
                    name={requesterName}
                />

                {#if !success}
                    <div class="w-full">
                        <label
                            for="relation-description"
                            class="text-xs font-semibold text-black-500 uppercase tracking-wider block mb-1"
                        >
                            Relationship Description
                        </label>
                        <textarea
                            id="relation-description"
                            class="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-black-700 resize-none focus:outline-none focus:border-primary"
                            rows="3"
                            placeholder="Describe how you know this person..."
                            value={relationDescription}
                            oninput={(e) =>
                                onDescriptionChange(e.currentTarget.value)}
                        ></textarea>
                    </div>

                    {#if error}
                        <div
                            class="bg-red-50 border border-red-200 rounded-2xl p-4 w-full text-sm text-red-700"
                        >
                            {error}
                        </div>
                    {/if}
                {/if}
            </div>

            <div class="shrink-0 flex w-full flex-col gap-3 pb-2 pt-6">
                {#if success}
                    <Button.Action
                        variant="solid"
                        class="w-full"
                        callback={onDecline}>Okay</Button.Action
                    >
                {:else}
                    <div class="flex justify-center gap-3 items-center w-full">
                        {#if error}
                            <Button.Action
                                variant="solid"
                                class="w-full"
                                callback={onDecline}>Okay</Button.Action
                            >
                        {:else}
                            <Button.Action
                                variant="soft"
                                class="w-full"
                                callback={onDecline}>Decline</Button.Action
                            >
                            <Button.Action
                                variant="solid"
                                class="w-full whitespace-nowrap"
                                callback={onConfirm}
                                disabled={loading}
                            >
                                {loading ? "Signing…" : "Sign Binding"}
                            </Button.Action>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    </BottomSheet>
{/if}
