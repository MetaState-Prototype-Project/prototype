<script lang="ts">
import { m } from "$lib/i18n";
import { ButtonAction } from "$lib/ui";
import BottomSheet from "$lib/ui/BottomSheet/BottomSheet.svelte";
import { PERSONAL_BINDING_MAX_LENGTH } from "$lib/utils/personalBinding";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";

interface IAddParametersSheetProps {
    isOpen: boolean;
    currentText?: string;
    /** Called with the new text. The page handles persisting + closing. */
    onsave?: (text: string) => void;
}

let {
    isOpen = $bindable(),
    currentText = "",
    onsave,
}: IAddParametersSheetProps = $props();

let value = $state("");

$effect(() => {
    if (isOpen) value = currentText;
});

function save() {
    if (!value.trim()) return;
    onsave?.(value.trim());
    isOpen = false;
}

function close() {
    isOpen = false;
}
</script>

<BottomSheet bind:isOpen>
    <header class="flex items-center justify-between">
        <h2 class="text-2xl font-bold text-black-900">{m.parameters_sheet_title()}</h2>
        <button
            type="button"
            aria-label={m.common_close()}
            class="w-9 h-9 rounded-full bg-black-50 flex items-center justify-center active:opacity-70"
            onclick={close}
        >
            <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={2} />
        </button>
    </header>

    <div class="flex flex-col gap-4">
        <p class="text-black-500 leading-snug">
            <span class="text-black-900 font-medium"
                >{m.parameters_sheet_lead()}</span
            >
            {m.parameters_sheet_body()}
        </p>

        <textarea
            bind:value
            rows="3"
            maxlength={PERSONAL_BINDING_MAX_LENGTH}
            placeholder={m.parameters_placeholder()}
            class="w-full bg-card-alternative rounded-2xl px-5 py-4 placeholder:text-black-300 outline-none focus:ring-2 focus:ring-primary resize-none"
        ></textarea>
        {#if value.length > PERSONAL_BINDING_MAX_LENGTH - 150}
            <p class="text-xs text-black-500 text-right -mt-2">
                {value.length} / {PERSONAL_BINDING_MAX_LENGTH}
            </p>
        {/if}

        <ButtonAction class="w-full" callback={save}>{m.common_save()}</ButtonAction>
    </div>
</BottomSheet>
