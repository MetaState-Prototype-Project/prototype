<script lang="ts">
import { m } from "$lib/paraglide/messages";
import { ButtonAction } from "$lib/ui";
import BottomSheet from "$lib/ui/BottomSheet/BottomSheet.svelte";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";

interface IEditNameSheetProps {
    isOpen: boolean;
    currentName?: string;
    saving?: boolean;
    error?: string | null;
    onsave?: (name: string) => void;
}

let {
    isOpen = $bindable(),
    currentName = "",
    saving = false,
    error = null,
    onsave,
}: IEditNameSheetProps = $props();

let name = $state("");

// Seed the input from the prop whenever the sheet opens. Doing it in an
// effect rather than at script-eval time means the user's previous typing
// doesn't linger across opens.
$effect(() => {
    if (!isOpen) return;
    name = currentName;
});

const trimmed = $derived(name.trim());
const canSave = $derived(
    trimmed.length > 0 && trimmed !== currentName.trim() && !saving,
);

function save() {
    if (!canSave) return;
    onsave?.(trimmed);
}

function close() {
    if (saving) return;
    isOpen = false;
}
</script>

<BottomSheet bind:isOpen dismissible={!saving}>
    <header class="flex items-center justify-between">
        <h2 class="text-2xl font-bold text-black-900">{m.edit_name_title()}</h2>
        <button
            type="button"
            aria-label={m.common_close()}
            class="w-9 h-9 rounded-full bg-black-50 flex items-center justify-center active:opacity-70 disabled:opacity-40"
            onclick={close}
            disabled={saving}
        >
            <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={2} />
        </button>
    </header>

    <div class="flex flex-col gap-4">
        <p class="text-black-500 leading-snug">
            {m.edit_name_body()}
        </p>

        <div>
            <label for="edit-name" class="block text-black-500 mb-2">
                {m.edit_name_label()}
            </label>
            <input
                id="edit-name"
                type="text"
                autocomplete="off"
                autocorrect="off"
                autocapitalize="words"
                spellcheck="false"
                bind:value={name}
                maxlength={64}
                disabled={saving}
                class="w-full bg-card-alternative rounded-full px-5 py-4 placeholder:text-black-300 outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
            />
        </div>

        {#if error}
            <p class="text-sm text-danger" role="alert">{error}</p>
        {/if}

        <ButtonAction
            class="w-full"
            callback={save}
            disabled={!canSave}
            isLoading={saving}
            blockingClick
        >
            {m.common_save()}
        </ButtonAction>
    </div>
</BottomSheet>
