<!--
    Legal ID row inside Binding Documents: tappable green row that expands
    into the user's id_document binding card. Empty state shows a neutral
    row with an ADD button.
-->
<script lang="ts">
import {
    ArrowDown01Icon,
    ArrowUp01Icon,
    IdentificationIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";

export interface LegalIdDoc {
    title: string;
    name?: string;
    dateOfBirth?: string;
    documentNumber?: string;
}

interface ILegalIdAccordionProps {
    doc?: LegalIdDoc | null;
    /** Fired when the ADD button is tapped — opens the KYC flow. */
    onadd?: () => void;
}

const { doc, onadd }: ILegalIdAccordionProps = $props();

let expanded = $state(false);

const hasDoc = $derived(!!doc);
const subtitle = $derived(doc?.title ?? "Any legal doc");

function toggle() {
    if (!hasDoc) return;
    expanded = !expanded;
}

function handleAddClick(e: MouseEvent) {
    e.stopPropagation();
    onadd?.();
}
</script>

<div
    class="rounded-xl overflow-hidden transition-colors duration-200"
    class:bg-gray={!hasDoc}
    class:bg-lime-200={hasDoc}
>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        class="flex items-center gap-3 p-2.5"
        class:cursor-pointer={hasDoc}
        onclick={toggle}
        role="button"
        tabindex={hasDoc ? 0 : -1}
        aria-expanded={expanded}
        aria-disabled={!hasDoc}
    >
        <div
            class="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 shrink-0 relative"
        >
            <HugeiconsIcon
                icon={IdentificationIcon}
                size={20}
                strokeWidth={2}
            />
            {#if hasDoc}
                <span
                    class="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-lime-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-lime-200"
                    aria-hidden="true">✓</span
                >
            {/if}
        </div>
        <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1">
                <p class="font-semibold text-black-900 leading-tight">
                    Legal ID
                </p>
                {#if hasDoc}
                    <HugeiconsIcon
                        icon={expanded ? ArrowUp01Icon : ArrowDown01Icon}
                        size={16}
                        strokeWidth={2}
                    />
                {/if}
            </div>
            <p class="text-xs text-black-500 leading-tight truncate">
                {subtitle}
            </p>
        </div>
        <button
            type="button"
            onclick={handleAddClick}
            class="bg-white text-black-700 text-[10px] font-bold uppercase tracking-wide px-4 py-1.5 rounded-full active:opacity-70 shrink-0"
        >
            Add
        </button>
    </div>

    {#if hasDoc && expanded && doc}
        <article class="px-3 pb-3 pt-1 flex flex-col gap-3">
            <h3 class="text-xl font-bold text-black-900 leading-tight">
                {doc.title}
            </h3>
            {#if doc.name}
                <div>
                    <p class="text-xs text-black-700 leading-tight">Name</p>
                    <p class="font-semibold text-black-900 leading-tight">
                        {doc.name}
                    </p>
                </div>
            {/if}
            {#if doc.dateOfBirth}
                <div>
                    <p class="text-xs text-black-700 leading-tight">
                        Date of Birth
                    </p>
                    <p class="font-semibold text-black-900 leading-tight">
                        {doc.dateOfBirth}
                    </p>
                </div>
            {/if}
            {#if doc.documentNumber}
                <div>
                    <p class="text-xs text-black-700 leading-tight">
                        Document number
                    </p>
                    <p class="font-semibold text-black-900 leading-tight">
                        {doc.documentNumber}
                    </p>
                </div>
            {/if}
        </article>
    {/if}
</div>
