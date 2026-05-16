<script lang="ts">
    import { ButtonAction } from "$lib/ui";
    import { onMount } from "svelte";
    import StepHeader from "./StepHeader.svelte";

    interface IPinCreateProps {
        /** Fired when the back chevron is tapped. */
        onback?: () => void;
        /** Fired with the entered 4-digit PIN once the user taps Next. */
        oncomplete?: (pin: string) => void;
    }

    const { onback, oncomplete }: IPinCreateProps = $props();

    let pin = $state("");
    let inputEl: HTMLInputElement | undefined = $state();
    const canSubmit = $derived(pin.length === 4);

    onMount(() => {
        inputEl?.focus();
    });

    const handleInput = (e: Event) => {
        const raw = (e.target as HTMLInputElement).value;
        pin = raw.replace(/\D/g, "").slice(0, 4);
    };

    const handleSubmit = () => {
        if (!canSubmit) return;
        oncomplete?.(pin);
    };
</script>

<main
    class="min-h-dvh px-[5vw] flex flex-col bg-white"
    style="padding-top: max(2svh, env(safe-area-inset-top)); padding-bottom: max(16px, env(safe-area-inset-bottom));"
>
    <StepHeader title="Create PIN-code" step={1} {onback} />

    <section class="flex-1 flex flex-col items-center justify-center">
        <button
            type="button"
            class="flex gap-6 items-center cursor-text"
            onclick={() => inputEl?.focus()}
            aria-label="PIN input — 4 digits"
        >
            {#each Array(4) as _, i (i)}
                <div
                    class="w-11 h-17 rounded-full bg-white flex items-center justify-center text-4xl font-extrabold text-black-900 font-condensed"
                    style="box-shadow: 0px 4px 19.9px 0px #00000024;"
                >
                    {pin[i] ?? ""}
                </div>
            {/each}
        </button>

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
        >
            Next
        </ButtonAction>
    </footer>
</main>
