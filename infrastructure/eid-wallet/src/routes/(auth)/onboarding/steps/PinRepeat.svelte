<script lang="ts">
import { keyboardInset } from "$lib/actions/keyboardInset";
import { ButtonAction, PinDots } from "$lib/ui";
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
let error = $state<string | null>(null);
const canSubmit = $derived(pin.length === 4);

$effect(() => {
    if (pin.length > 0 && error) error = null;
});

const handleSubmit = async () => {
    if (!canSubmit) return;
    if (pin !== firstAttempt) {
        error = "PIN codes don't match. Try again.";
        pin = "";
        return;
    }
    try {
        await oncomplete?.(pin);
    } catch (err) {
        console.error("Failed to confirm PIN:", err);
        error = "Couldn't save your PIN. Please try again.";
        pin = "";
    }
};
</script>

<main
    use:keyboardInset
    class="min-h-dvh px-[5vw] flex flex-col bg-white"
    style="padding-top: max(2svh, env(safe-area-inset-top)); padding-bottom: calc(max(16px, env(safe-area-inset-bottom)) + var(--kb-inset, 0px));"
>
    <StepHeader title="Repeat PIN-code" step={2} {onback} />

    <section class="flex-1 flex flex-col items-center justify-center gap-6">
        <PinDots bind:pin />

        {#if error}
            <p class="text-danger text-sm font-medium" role="alert">{error}</p>
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
