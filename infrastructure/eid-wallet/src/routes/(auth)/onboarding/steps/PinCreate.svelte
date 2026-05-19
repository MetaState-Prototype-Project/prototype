<script lang="ts">
import { keyboardInset } from "$lib/actions/keyboardInset";
import { ButtonAction, PinDots } from "$lib/ui";
import StepHeader from "./StepHeader.svelte";

interface IPinCreateProps {
    /** Fired when the back chevron is tapped. */
    onback?: () => void;
    /** Fired with the entered 4-digit PIN once the user taps Next. */
    oncomplete?: (pin: string) => void;
}

const { onback, oncomplete }: IPinCreateProps = $props();

let pin = $state("");
const canSubmit = $derived(pin.length === 4);

const handleSubmit = () => {
    if (!canSubmit) return;
    oncomplete?.(pin);
};
</script>

<main
    use:keyboardInset
    class="min-h-dvh px-[5vw] flex flex-col bg-white"
    style="padding-top: max(2svh, env(safe-area-inset-top)); padding-bottom: calc(max(16px, env(safe-area-inset-bottom)) + var(--kb-inset, 0px));"
>
    <StepHeader title="Create PIN-code" step={1} {onback} />

    <section class="flex-1 flex flex-col items-center justify-center">
        <PinDots bind:pin />
    </section>

    <footer class="w-full">
        <ButtonAction
            class="w-full uppercase tracking-wide"
            disabled={!canSubmit}
            callback={handleSubmit}
        >
            Next
        </ButtonAction>
    </footer>
</main>
