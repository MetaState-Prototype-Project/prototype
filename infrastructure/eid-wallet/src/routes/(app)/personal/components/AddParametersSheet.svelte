<script lang="ts">
import { personalBinding, setParameters } from "$lib/stores/personalBinding";
import { ButtonAction } from "$lib/ui";
import BottomSheet from "$lib/ui/BottomSheet/BottomSheet.svelte";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";

interface IAddParametersSheetProps {
    isOpen: boolean;
}

let { isOpen = $bindable() }: IAddParametersSheetProps = $props();

let value = $state("");

// Seed from the store every time the sheet opens (so editing shows current).
$effect(() => {
    if (isOpen) value = $personalBinding.parameters;
});

function save() {
    setParameters(value);
    isOpen = false;
}

function close() {
    isOpen = false;
}
</script>

<BottomSheet bind:isOpen>
    <header class="flex items-center justify-between">
        <h2 class="text-2xl font-bold text-black-900">Parameters</h2>
        <button
            type="button"
            aria-label="Close"
            class="w-9 h-9 rounded-full bg-black-50 flex items-center justify-center active:opacity-70"
            onclick={close}
        >
            <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={2} />
        </button>
    </header>

    <div class="flex flex-col gap-4">
        <p class="text-black-500 leading-snug">
            <span class="text-black-900 font-medium">Personal details:</span>
            date and place of birth, height, eye color and etc
        </p>

        <textarea
            bind:value
            rows="3"
            placeholder="A birthmark on the buttock in the shape of Greenland"
            class="w-full bg-card-alternative rounded-2xl px-5 py-4 placeholder:text-black-300 outline-none focus:ring-2 focus:ring-primary resize-none"
        ></textarea>

        <ButtonAction class="w-full" callback={save}>Save</ButtonAction>
    </div>
</BottomSheet>
