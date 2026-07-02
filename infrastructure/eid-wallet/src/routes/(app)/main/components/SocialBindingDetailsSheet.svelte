<script lang="ts">
import { BottomSheet, ButtonAction } from "$lib/ui";
import type { SocialBindingDisplay } from "./SocialBindingAccordion.svelte";

interface ISocialBindingDetailsSheetProps {
    isOpen: boolean;
    /** The contact whose bindings to show. Null when the sheet is closed. */
    contact: SocialBindingDisplay | null;
    onfulllist?: () => void;
    onOpenChange?: (open: boolean) => void;
}

let {
    isOpen = $bindable(),
    contact,
    onfulllist,
    onOpenChange,
}: ISocialBindingDetailsSheetProps = $props();

function roleLabel(role: "sent" | "received" | "both"): string {
    if (role === "both") return "Sent & Received";
    if (role === "sent") return "Sent";
    return "Received";
}

function formatTimestamp(iso: string): string {
    if (!iso) return "";
    try {
        const d = new Date(iso);
        return d.toLocaleString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    } catch {
        return iso;
    }
}

function close() {
    isOpen = false;
    onOpenChange?.(false);
}
</script>

<BottomSheet bind:isOpen {onOpenChange}>
    {#if contact}
        <header class="flex flex-col gap-1 text-center">
            <h2 class="text-2xl font-bold text-black-900">
                {contact.counterpartyName}
            </h2>
            <p class="text-sm text-black-500 break-all">
                {contact.counterpartyEname}
            </p>
        </header>

        <div class="flex justify-center">
            <span
                class="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold {contact.pending
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-success-200 text-black-900'}"
            >
                {contact.pending
                    ? "Awaiting confirmation"
                    : roleLabel(contact.role)}
            </span>
        </div>

        <div class="flex flex-col gap-2">
            {#each contact.bindings as binding (binding.docId)}
                <div
                    class="flex items-start justify-between gap-3 rounded-2xl bg-card-alternative px-4 py-3"
                >
                    <div class="flex-1 min-w-0">
                        <p class="font-semibold text-black-900 text-sm">
                            {binding.role === "sent" ? "Sent" : "Received"}
                            {#if !binding.mutuallySigned}
                                <span class="font-normal text-amber-600"
                                    >· Awaiting confirmation</span
                                >
                            {/if}
                        </p>
                        {#if binding.relationDescription}
                            <p
                                class="text-sm text-black-700 mt-0.5 leading-snug"
                            >
                                {binding.relationDescription}
                            </p>
                        {/if}
                        {#if binding.completedAt}
                            <p class="text-xs text-black-500 mt-1">
                                {formatTimestamp(binding.completedAt)}
                            </p>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>

        <div class="flex flex-col gap-2 pt-2">
            <ButtonAction
                class="w-full uppercase tracking-wide"
                callback={() => {
                    close();
                    onfulllist?.();
                }}
            >
                View on full list
            </ButtonAction>
            <ButtonAction
                variant="soft"
                class="w-full uppercase tracking-wide"
                callback={close}
            >
                Close
            </ButtonAction>
        </div>
    {/if}
</BottomSheet>
