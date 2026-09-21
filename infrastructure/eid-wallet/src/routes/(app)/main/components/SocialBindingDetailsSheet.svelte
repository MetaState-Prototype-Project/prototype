<script lang="ts">
import { m } from "$lib/paraglide/messages";
import { getLocale } from "$lib/paraglide/runtime";
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
    if (role === "both") return m.social_role_sent_received();
    if (role === "sent") return m.social_role_sent();
    return m.social_role_received();
}

function formatTimestamp(iso: string): string {
    if (!iso) return "";
    try {
        const d = new Date(iso);
        return d.toLocaleString(getLocale(), {
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
                    ? m.social_details_awaiting()
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
                            {binding.role === "sent" ? m.social_role_sent() : m.social_role_received()}
                            {#if !binding.mutuallySigned}
                                <span class="font-normal text-amber-600"
                                    >{m.social_details_awaiting_suffix()}</span
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
                {m.social_details_view_full_list()}
            </ButtonAction>
            <ButtonAction
                variant="soft"
                class="w-full uppercase tracking-wide"
                callback={close}
            >
                {m.common_close()}
            </ButtonAction>
        </div>
    {/if}
</BottomSheet>
