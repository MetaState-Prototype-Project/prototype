<script lang="ts">
import { ButtonAction } from "$lib/ui";
import BottomSheet from "$lib/ui/BottomSheet/BottomSheet.svelte";
import { PERSONAL_BINDING_MAX_LENGTH } from "$lib/utils/personalBinding";
import {
    Cancel01Icon,
    ViewIcon,
    ViewOffIcon,
} from "@hugeicons/core-free-icons";
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
// The answer is sensitive — mask it by default, with an eye toggle to reveal
// (the spelling tip above means the user needs to be able to check it).
let showAnswer = $state(false);

// On open: seed the question from the prop. Answer always starts blank —
// we never round-trip the raw answer, so editing means re-entering it.
$effect(() => {
    if (!isOpen) return;
    question = currentQuestion;
    answer = "";
    showAnswer = false;
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
                maxlength={PERSONAL_BINDING_MAX_LENGTH}
                placeholder="e.g. Name of the street you grew up on"
                class="w-full bg-card-alternative rounded-full px-5 py-4 placeholder:text-black-300 outline-none focus:ring-2 focus:ring-primary"
            />
            {#if question.length > PERSONAL_BINDING_MAX_LENGTH - 150}
                <p class="text-xs text-black-500 text-right mt-1">
                    {question.length} / {PERSONAL_BINDING_MAX_LENGTH}
                </p>
            {/if}
        </div>

        <div>
            <label for="kn-answer" class="block text-black-500 mb-2">
                Answer
            </label>
            <div class="relative">
                <input
                    id="kn-answer"
                    type={showAnswer ? "text" : "password"}
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck="false"
                    bind:value={answer}
                    maxlength={PERSONAL_BINDING_MAX_LENGTH}
                    class="w-full bg-card-alternative rounded-full pl-5 pr-14 py-4 placeholder:text-black-300 outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                    type="button"
                    onclick={() => {
                        showAnswer = !showAnswer;
                    }}
                    aria-label={showAnswer ? "Hide answer" : "Show answer"}
                    aria-pressed={showAnswer}
                    class="absolute inset-y-0 right-0 flex items-center pr-5 text-black-500 active:opacity-70"
                >
                    <HugeiconsIcon
                        icon={showAnswer ? ViewOffIcon : ViewIcon}
                        size={20}
                        color="currentColor"
                        strokeWidth={2}
                    />
                </button>
            </div>
            {#if answer.length > PERSONAL_BINDING_MAX_LENGTH - 150}
                <p class="text-xs text-black-500 text-right mt-1">
                    {answer.length} / {PERSONAL_BINDING_MAX_LENGTH}
                </p>
            {/if}
        </div>

        <ButtonAction class="w-full" callback={save} disabled={!canSave}>
            Save
        </ButtonAction>
    </div>
</BottomSheet>
