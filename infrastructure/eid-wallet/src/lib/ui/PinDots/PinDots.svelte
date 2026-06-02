<script lang="ts">
import { onMount, tick } from "svelte";

interface IPinDotsProps {
    pin: string;
    autofocus?: boolean;
    class?: string;
    /** Bind a reference to the underlying hidden input so the parent can
     *  trigger focus from elsewhere (e.g. a background tap on /login). */
    inputEl?: HTMLInputElement | undefined;
}

let {
    pin = $bindable(""),
    autofocus = true,
    class: classes = "",
    inputEl = $bindable<HTMLInputElement | undefined>(undefined),
}: IPinDotsProps = $props();

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

// iOS-style "briefly reveal the digit you just typed before masking". When
// pin grows by one, surface that index for REVEAL_MS; another keystroke
// before then cancels the timer and reveals the new index instead. Backspace
// or clear hides the reveal immediately.
const REVEAL_MS = 700;
let revealedIndex = $state(-1);
let prevLength = 0;

$effect(() => {
    const len = pin.length;
    if (len > prevLength) {
        const idx = len - 1;
        revealedIndex = idx;
        prevLength = len;
        const timer = setTimeout(() => {
            revealedIndex = -1;
        }, REVEAL_MS);
        return () => clearTimeout(timer);
    }
    if (len < prevLength) {
        revealedIndex = -1;
    }
    prevLength = len;
});
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
            class="w-11 h-17 rounded-full bg-white flex items-center justify-center"
            style="box-shadow: 0px 4px 19.9px 0px #00000024;"
        >
            {#if pin[i] && i === revealedIndex}
                <span
                    class="text-4xl font-extrabold text-black-900 font-condensed"
                >
                    {pin[i]}
                </span>
            {:else if pin[i]}
                <span class="w-4 h-4 rounded-full bg-black-900"></span>
            {/if}
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
