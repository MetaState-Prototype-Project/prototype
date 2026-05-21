<!--
    Social binding row inside Binding Documents. Empty state is a neutral row
    with an INVITE button (matches the existing pattern). Once the user has at
    least one binding the row turns green, lists the first few contacts, and
    can be tapped to expand into the preview + FULL LIST CTA.
-->
<script lang="ts">
import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import { slide } from "svelte/transition";

export interface SocialBindingDisplay {
    /** eName of the other party. */
    counterpartyEname: string;
    /** Resolved display name; falls back to eName if resolution failed. */
    counterpartyName: string;
}

interface ISocialBindingAccordionProps {
    /** Total count across all bindings — used for the chip ("X contacts").
     *  May be larger than `previewBindings.length` when the parent only
     *  resolved names for the first N. */
    totalCount: number;
    /** Names to surface inline. Typically the first 5. */
    previewBindings: SocialBindingDisplay[];
    oninvite?: () => void;
    onfulllist?: () => void;
}

const {
    totalCount,
    previewBindings,
    oninvite,
    onfulllist,
}: ISocialBindingAccordionProps = $props();

let expanded = $state(false);

const hasBindings = $derived(totalCount > 0);

function toggle() {
    if (!hasBindings) return;
    expanded = !expanded;
}

function handleInviteClick(e: MouseEvent) {
    e.stopPropagation();
    oninvite?.();
}

const previewLine = $derived.by(() => {
    if (previewBindings.length === 0) return "";
    const names = previewBindings.map((b) => b.counterpartyName);
    const shown = names.slice(0, 5).join(", ");
    const remaining = totalCount - Math.min(5, previewBindings.length);
    return remaining > 0 ? `${shown} and ${remaining} others` : shown;
});
</script>

<div
    class="rounded-3xl overflow-hidden transition-colors duration-200 {hasBindings
        ? 'bg-success-200'
        : 'bg-card-alternative'}"
>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        class="flex items-center gap-3 px-3 py-4"
        class:cursor-pointer={hasBindings}
        onclick={toggle}
        role="button"
        tabindex={hasBindings ? 0 : -1}
        aria-expanded={expanded}
        aria-disabled={!hasBindings}
    >
        <div class="relative shrink-0">
            <img
                src="/images/SocialBinding.png"
                alt=""
                width="40"
                height="40"
                class="block w-10 h-10 object-contain"
                aria-hidden="true"
            />
            {#if hasBindings}
                <span
                    class="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-success-500 text-white text-chip font-bold flex items-center justify-center border-2 border-white"
                    aria-hidden="true">✓</span
                >
            {/if}
        </div>
        <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1">
                <p class="font-medium text-lg text-black-900 leading-tight">
                    Social binding
                </p>
                {#if hasBindings}
                    <HugeiconsIcon
                        icon={expanded ? ArrowUp01Icon : ArrowDown01Icon}
                        size={16}
                        strokeWidth={2}
                    />
                {/if}
            </div>
            {#if hasBindings}
                <p class="text-black-700 leading-tight">
                    {totalCount}
                    {totalCount === 1 ? "contact" : "contacts"}
                </p>
            {:else}
                <p class="text-primary font-medium leading-tight">
                    New level of trust
                </p>
            {/if}
        </div>
        <button
            type="button"
            onclick={handleInviteClick}
            class="bg-primary text-white h-11 text-pill font-medium uppercase tracking-wide px-4 py-1.5 rounded-full active:opacity-80 shrink-0"
        >
            Invite
        </button>
    </div>

    {#if hasBindings && expanded}
        <article
            transition:slide={{ duration: 200 }}
            class="px-3 pb-3 pt-1 flex flex-col gap-3"
        >
            {#if previewLine}
                <p class="text-black-900 font-medium leading-snug">
                    {previewLine}
                </p>
            {/if}
            <button
                type="button"
                onclick={onfulllist}
                class="bg-white text-black-900 text-pill font-bold uppercase tracking-wide px-4 py-3 rounded-full active:opacity-80"
            >
                Full list
            </button>
        </article>
    {/if}
</div>
