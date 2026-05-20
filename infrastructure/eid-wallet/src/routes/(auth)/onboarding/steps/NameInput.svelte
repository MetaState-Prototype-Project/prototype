<script lang="ts">
import { ButtonAction } from "$lib/ui";
import { onMount } from "svelte";
import StepHeader from "./StepHeader.svelte";

interface INameInputProps {
    /** Fired when the back chevron is tapped. */
    onback?: () => void;
    /** Fired with the trimmed name once the user taps Next. May return a Promise —
     *  the button shows a loading state until it settles. */
    oncomplete?: (name: string) => Promise<void> | void;
    /** Error message rendered under the input — set by the parent when
     *  provisioning fails. */
    error?: string | null;
}

const { onback, oncomplete, error = null }: INameInputProps = $props();

let name = $state("");
let inputEl: HTMLInputElement | undefined = $state();
const trimmed = $derived(name.trim());
const canSubmit = $derived(trimmed.length > 0);

onMount(() => {
    inputEl?.focus();
});

const handleSubmit = async () => {
    if (!canSubmit) return;
    await oncomplete?.(trimmed);
};
</script>

<main
    class="min-h-dvh px-[5vw] flex flex-col bg-white"
    style="padding-top: max(2svh, env(safe-area-inset-top)); padding-bottom: max(16px, env(safe-area-inset-bottom));"
>
    <StepHeader title="What's your name?" step={3} {onback} />

    <section class="flex-1 flex flex-col justify-center">
        <label for="name" class="text-black opacity-50 text-lg font-medium">Enter your name</label>
        <input
            name="name"
            bind:this={inputEl}
            type="text"
            bind:value={name}
            placeholder="Alex for example"
            autocomplete="given-name"
            autocapitalize="words"
            maxlength="64"
            class="w-full text-display font-condensed font-bold text-black-900 placeholder:text-black-900 placeholder:opacity-20 bg-transparent outline-none"
        />

        {#if error}
            <p class="text-danger text-sm font-medium text-center" role="alert">
                {error}
            </p>
        {/if}
    </section>

    <footer class="w-full">
        <ButtonAction
            class="w-full uppercase tracking-wide"
            disabled={!canSubmit}
            callback={handleSubmit}
            blockingClick={true}
        >
            Next
        </ButtonAction>
    </footer>
</main>
