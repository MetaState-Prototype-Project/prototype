<script lang="ts">
import { ButtonAction } from "$lib/ui";
import BottomSheet from "$lib/ui/BottomSheet/BottomSheet.svelte";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";

interface IAddKnowledgeSheetProps {
    isOpen: boolean;
    currentQuestion?: string;
    onsave?: (data: { question: string; answer: string }) => void;
}

let {
    isOpen = $bindable(),
    currentQuestion = "",
    onsave,
}: IAddKnowledgeSheetProps = $props();

let question = $state("");
let answer = $state("");

// On open: seed the question from the prop. Answer always starts blank —
// we never round-trip the raw answer, so editing means re-entering it.
$effect(() => {
    if (!isOpen) return;
    question = currentQuestion;
    answer = "";
});

const canSave = $derived(
    question.trim().length > 0 && answer.trim().length > 0,
);

function save() {
    if (!canSave) return;
    onsave?.({ question: question.trim(), answer: answer.trim() });
    isOpen = false;
}

function close() {
    isOpen = false;
}
</script>

<BottomSheet bind:isOpen>
    <header class="flex items-center justify-between">
        <h2 class="text-2xl font-bold text-black-900">Knowledge</h2>
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
            Ask a question that only you can answer. Tip: Include a reminder
            about the correct spelling of the answer.
        </p>

        <div>
            <label for="kn-question" class="block text-black-500 mb-2">
                Question
            </label>
            <input
                id="kn-question"
                type="text"
                bind:value={question}
                placeholder="e.g. Name of the street you grew up on"
                class="w-full bg-card-alternative rounded-full px-5 py-4 placeholder:text-black-300 outline-none focus:ring-2 focus:ring-primary"
            />
        </div>

        <div>
            <label for="kn-answer" class="block text-black-500 mb-2">
                Answer
            </label>
            <input
                id="kn-answer"
                type="text"
                autocomplete="off"
                autocorrect="off"
                autocapitalize="off"
                spellcheck="false"
                bind:value={answer}
                class="w-full bg-card-alternative rounded-full px-5 py-4 placeholder:text-black-300 outline-none focus:ring-2 focus:ring-primary"
            />
        </div>

        <ButtonAction class="w-full" callback={save} disabled={!canSave}>
            Save
        </ButtonAction>
    </div>
</BottomSheet>
