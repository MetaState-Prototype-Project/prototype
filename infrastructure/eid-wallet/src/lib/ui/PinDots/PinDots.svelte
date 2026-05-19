<script lang="ts">
import { onMount, tick } from "svelte";

interface IPinDotsProps {
    pin: string;
    autofocus?: boolean;
    class?: string;
}

let {
    pin = $bindable(""),
    autofocus = true,
    class: classes = "",
}: IPinDotsProps = $props();

let inputEl: HTMLInputElement | undefined = $state();

// Android WebView only attaches its IME input connection after first paint;
// focus before that is a no-op for the soft keyboard.
onMount(async () => {
    if (!autofocus) return;
    await tick();
    requestAnimationFrame(() => {
        inputEl?.focus({ preventScroll: true });
    });
});

function handleInput(e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    pin = raw.replace(/\D/g, "").slice(0, 4);
}

function focusInput() {
    inputEl?.focus({ preventScroll: true });
}

const isEmpty = $derived(pin.length === 0);
</script>

<button
    type="button"
    class="flex gap-6 items-center cursor-text {classes}"
    class:pulse={isEmpty}
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

<!-- Laid out (not `sr-only`) so Android WebView treats the input as on-screen
     and opens the soft keyboard when it gets focus. -->
<!-- svelte-ignore a11y_autofocus -->
<input
    bind:this={inputEl}
    type="tel"
    inputmode="numeric"
    pattern="\d*"
    maxlength="4"
    autocomplete="one-time-code"
    value={pin}
    oninput={handleInput}
    autofocus={autofocus}
    class="absolute opacity-0 w-px h-px -z-10 pointer-events-none"
    style="caret-color: transparent;"
    aria-hidden="true"
    tabindex="-1"
/>

<style>
@keyframes pinPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
}
.pulse {
    animation: pinPulse 1.8s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
    .pulse { animation: none; }
}
</style>
