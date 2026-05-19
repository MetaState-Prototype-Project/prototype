<!--
    Four rounded-circle digit slots backed by a single hidden numeric input.
    Replaces the legacy InputPin (4 separate boxes with dot-mask) on the
    redesigned auth screens. Parent binds the `pin` string and reacts to it
    (e.g. on length === 4) — this component just handles input + display.
-->
<script lang="ts">
import { onMount } from "svelte";

interface IPinDotsProps {
    /** The current 4-digit PIN value. Bound, parent reacts on length === 4. */
    pin: string;
    /** Focus the hidden input on mount. Defaults to true. */
    autofocus?: boolean;
    /** Optional extra class on the outer wrapper. */
    class?: string;
}

let {
    pin = $bindable(""),
    autofocus = true,
    class: classes = "",
}: IPinDotsProps = $props();

let inputEl: HTMLInputElement | undefined = $state();

onMount(() => {
    if (autofocus) inputEl?.focus();
});

function handleInput(e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    pin = raw.replace(/\D/g, "").slice(0, 4);
}

function focusInput() {
    inputEl?.focus();
}
</script>

<button
    type="button"
    class="flex gap-6 items-center cursor-text {classes}"
    onclick={focusInput}
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
