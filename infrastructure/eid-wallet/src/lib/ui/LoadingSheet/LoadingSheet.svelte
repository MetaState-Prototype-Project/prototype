<script lang="ts">
/**
 * Bottom-sheet loading indicator in the new design language.
 *
 * Use this for any "doing a thing that takes >300ms" state instead of
 * replacing the page content with a centered spinner. The underlying screen
 * stays mounted behind a blurred backdrop, giving the user visual context
 * for what they were doing.
 *
 * The sheet itself is non-dismissible (no tap-to-close on the backdrop); the
 * optional Cancel button is the only way out, so callers can wire it to
 * abort the in-flight operation when one exists.
 */
import { ButtonAction } from "$lib/ui";
import { Shadow } from "svelte-loading-spinners";
import BottomSheet from "../BottomSheet/BottomSheet.svelte";

interface LoadingSheetProps {
    isOpen: boolean;
    /** Big bold line at the top — what's happening, in user terms. */
    title: string;
    /** Soft grey body copy underneath the title. Optional. */
    subtitle?: string;
    /** When provided, a "Cancel" soft-button is rendered. The handler should
     *  also flip `isOpen` to false. */
    oncancel?: () => void;
    /** Label override for the cancel button. */
    cancelLabel?: string;
}

const {
    isOpen,
    title,
    subtitle,
    oncancel,
    cancelLabel = "Cancel",
}: LoadingSheetProps = $props();
</script>

<BottomSheet {isOpen} dismissible={false}>
    <div class="flex flex-col items-center text-center gap-5 pt-2 pb-1">
        <Shadow size={40} color="rgb(142, 82, 255)" />
        <div class="max-w-xs">
            <h4 class="text-xl font-bold mb-2">{title}</h4>
            {#if subtitle}
                <p class="text-black-700 text-sm">{subtitle}</p>
            {/if}
        </div>
        {#if oncancel}
            <ButtonAction
                variant="soft"
                class="w-full uppercase tracking-wide mt-2"
                callback={oncancel}
            >
                {cancelLabel}
            </ButtonAction>
        {/if}
    </div>
</BottomSheet>
