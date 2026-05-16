<script lang="ts">
import { ButtonAction } from "$lib/ui";
import { onMount } from "svelte";
import StepHeader from "./StepHeader.svelte";

interface IPinRepeatProps {
    /** The PIN the user entered on the previous step — used to validate the match. */
    firstAttempt: string;
    /** Fired when the back chevron is tapped. */
    onback?: () => void;
    /** Fired with the confirmed 4-digit PIN once it matches the first attempt.
     *  May return a Promise — the button shows a loading state until it settles. */
    oncomplete?: (pin: string) => Promise<void> | void;
}

const { firstAttempt, onback, oncomplete }: IPinRepeatProps = $props();

let pin = $state("");
let inputEl: HTMLInputElement | undefined = $state();
let error = $state<string | null>(null);
const canSubmit = $derived(pin.length === 4);

onMount(() => {
    inputEl?.focus();
});

const handleInput = (e: Event) => {
    const raw = (e.target as HTMLInputElement).value;
    pin = raw.replace(/\D/g, "").slice(0, 4);
    if (pin.length > 0 && error) error = null;
};

const handleSubmit = async () => {
    if (!canSubmit) return;
    if (pin !== firstAttempt) {
        error = "PIN codes don't match. Try again.";
        pin = "";
        inputEl?.focus();
        return;
    }
    try {
        await oncomplete?.(pin);
    } catch (err) {
        console.error("Failed to confirm PIN:", err);
        error = "Couldn't save your PIN. Please try again.";
        pin = "";
        inputEl?.focus();
    }
};
</script>

<main
    class="min-h-dvh px-[5vw] flex flex-col bg-white"
    style="padding-top: max(2svh, env(safe-area-inset-top)); padding-bottom: max(16px, env(safe-area-inset-bottom));"
>
    <StepHeader title="Repeat PIN-code" step={2} {onback} />

    <section class="flex-1 flex flex-col items-center justify-center gap-6">
        <button
            type="button"
            class="flex gap-6 items-center cursor-text"
            onclick={() => inputEl?.focus()}
            aria-label="PIN input — 4 digits"
        >
            {#each Array(4) as _, i (i)}
                <div
                    class="w-11 h-17 rounded-full bg-white flex items-center justify-center text-3xl font-semibold text-black-900"
                    style="box-shadow: 0px 4px 19.9px 0px #00000024;"
                >
                    {pin[i] ?? ""}
                </div>
            {/each}
        </button>

        {#if error}
            <p class="text-danger text-sm font-medium" role="alert">{error}</p>
        {/if}

        <input
            bind:this={inputEl}
            type="tel"
            inputmode="numeric"
            pattern="\d*"
            maxlength="4"
            autocomplete="one-time-code"
            value={pin}
            oninput={handleInput}
            class="sr-only"
            aria-hidden="true"
        />
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
