<!--
    Four rounded-circle digit slots backed by a single hidden numeric input.
    Replaces the legacy InputPin (4 separate boxes with dot-mask) on the
    redesigned auth screens. Parent binds the `pin` string and reacts to it
    (e.g. on length === 4) — this component just handles input + display.

    Known limitation: Android WebView will not open the soft keyboard from
    programmatic `focus()` without a fresh user gesture (platform-level
    restriction — manifest `stateAlwaysVisible`, HTML `autofocus`, and
    `requestAnimationFrame(focus)` all bounce off it). The dots pulse while
    empty to invite a tap; the keyboard opens reliably on first tap.
    Auto-open would require a native Kotlin bridge calling
    InputMethodManager.showSoftInput — see TODO in MEMORY.
-->
<script lang="ts">
import { onMount, tick } from "svelte";

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

// Android WebView only opens the soft keyboard when an input is laid out
// in the document (not `display: none` / off-screen) and is focused after
// the page has actually painted. `tick()` flushes Svelte's render queue
// and `requestAnimationFrame` waits for the browser's first paint.
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

<!--
    Visually hidden but laid out — `sr-only` uses clip+absolute which makes
    Android WebView treat the input as off-screen and refuse to open the
    soft keyboard. Keeping it `opacity-0` with zero size keeps it focusable
    while remaining invisible.
-->
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
