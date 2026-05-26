<script lang="ts">
import { BottomSheet, ButtonAction } from "$lib/ui";
import type { Snippet } from "svelte";

interface IInfoDrawerProps {
    isOpen: boolean;
    title: string;
    /** Whole drawer body — paragraphs, hero tile, sub-headings, etc. Each
     *  info drawer arranges its own content; the drawer only owns the
     *  header and the CTA. Use the `info-tile` class on a `<div>` to render
     *  the lavender square placeholder. */
    body: Snippet;
    cta?: string;
    onclose?: () => void;
}

let {
    isOpen = $bindable(false),
    title,
    body,
    cta = "Okay",
    onclose,
}: IInfoDrawerProps = $props();

function handleClose() {
    isOpen = false;
    onclose?.();
}
</script>

<BottomSheet bind:isOpen style="max-height: 95svh;">
    <div class="flex items-start justify-between gap-3">
        <h3 class="text-2xl font-bold text-black-900 leading-tight">
            {title}
        </h3>
        <button
            type="button"
            onclick={handleClose}
            aria-label="Close"
            class="w-11.5 h-11.5 rounded-full bg-black-50 flex items-center justify-center text-black-700 active:opacity-70 shrink-0"
        >
            <span aria-hidden="true" class="text-3xl leading-none">×</span>
        </button>
    </div>

    <div class="flex flex-col gap-4 text-black-500 leading-snug">
        {@render body()}
    </div>

    <ButtonAction
        variant="solid"
        class="w-full uppercase tracking-wide mt-2"
        callback={handleClose}
    >
        {cta}
    </ButtonAction>
</BottomSheet>
