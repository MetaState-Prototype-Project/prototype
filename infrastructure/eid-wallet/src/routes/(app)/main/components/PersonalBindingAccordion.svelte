<!--
    Personal row inside Binding Documents. Mirrors LegalIdAccordion's
    empty/filled visual treatment: neutral row with an ADD button when no
    marks exist, green expandable row showing the sub-marks once any have
    been filled in. Tapping ADD / EDIT routes to /personal.
-->
<script lang="ts">
import { marksAchieved, personalBinding } from "$lib/stores/personalBinding";
import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import { slide } from "svelte/transition";

interface IPersonalBindingAccordionProps {
    /** Fired when the ADD / EDIT button is tapped — opens /personal. */
    onopen?: () => void;
}

const { onopen }: IPersonalBindingAccordionProps = $props();

let expanded = $state(false);

const binding = $derived($personalBinding);
const achieved = $derived(marksAchieved(binding));
const hasAny = $derived(achieved > 0);

function toggle() {
    if (!hasAny) return;
    expanded = !expanded;
}

function handleKeydown(e: KeyboardEvent) {
    if (!hasAny) return;
    if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
    }
}

function handleAddClick(e: MouseEvent) {
    e.stopPropagation();
    onopen?.();
}
</script>

<div
    class="rounded-3xl overflow-hidden transition-colors duration-200 {hasAny
        ? 'bg-success-200'
        : 'bg-card-alternative'}"
>
    <div
        class="flex items-center gap-3 px-3 py-4"
        class:cursor-pointer={hasAny}
        onclick={toggle}
        onkeydown={handleKeydown}
        role="button"
        tabindex={hasAny ? 0 : -1}
        aria-expanded={expanded}
        aria-disabled={!hasAny}
    >
        <div class="relative shrink-0">
            <img
                src="/images/Personal.png"
                alt=""
                width="40"
                height="40"
                class="block w-10 h-10 object-contain"
                aria-hidden="true"
            />
            {#if hasAny}
                <span
                    class="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-success-500 text-white text-chip font-bold flex items-center justify-center border-2 border-white"
                    aria-hidden="true">✓</span
                >
            {/if}
        </div>
        <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1">
                <p class="font-medium text-lg text-black-900 leading-tight">
                    Personal
                </p>
                {#if hasAny}
                    <HugeiconsIcon
                        icon={expanded ? ArrowUp01Icon : ArrowDown01Icon}
                        size={16}
                        strokeWidth={2}
                    />
                {/if}
            </div>
            <p class="text-black-700 opacity-50 leading-tight">
                {hasAny ? `${achieved} of 3 marks achieved` : "Identity marks"}
            </p>
        </div>
        {#if !hasAny}
            <button
                type="button"
                onclick={handleAddClick}
                class="bg-white text-black-700 text-pill font-bold uppercase tracking-wide px-4 py-1.5 rounded-full active:opacity-70 shrink-0 h-11"
            >
                Add
            </button>
        {/if}
    </div>

    {#if hasAny && expanded}
        <article
            transition:slide={{ duration: 200 }}
            class="px-3 pb-3 pt-1 flex flex-col gap-3"
        >
            {#if binding.photos.length > 0}
                <div>
                    <p class="text-xs text-black-700 leading-tight">
                        Photo marks
                    </p>
                    <p class="font-semibold text-black-900 leading-tight">
                        {binding.photos.length}
                        {binding.photos.length === 1 ? "file" : "files"} uploaded
                    </p>
                </div>
            {/if}
            {#if binding.parameters && binding.parameters.text.trim().length > 0}
                <div>
                    <p class="text-xs text-black-700 leading-tight">
                        Biography marks
                    </p>
                    <p class="font-semibold text-black-900 leading-snug">
                        {binding.parameters.text}
                    </p>
                </div>
            {/if}
            {#if binding.knowledge}
                <div>
                    <p class="text-xs text-black-700 leading-tight">
                        Security question
                    </p>
                    <!-- Mask the answer like a password — the question itself
                         is not secret but the answer is. Showing **** keeps
                         the row visually consistent with the design. -->
                    <p class="font-semibold text-black-900 leading-tight tracking-widest">
                        ********
                    </p>
                </div>
            {/if}
            <button
                type="button"
                onclick={handleAddClick}
                class="mt-1 w-full bg-white text-black-900 font-bold uppercase tracking-wide text-sm rounded-full py-3 active:opacity-70"
            >
                Add / Edit
            </button>
        </article>
    {/if}
</div>
