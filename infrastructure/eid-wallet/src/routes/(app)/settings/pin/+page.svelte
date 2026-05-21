<script lang="ts">
import { goto } from "$app/navigation";
import { keyboardInset } from "$lib/actions/keyboardInset";
import type { GlobalState } from "$lib/global";
import { runtime } from "$lib/global/runtime.svelte";
import { BottomSheet, ButtonAction, PinDots } from "$lib/ui";
import { CircleLock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import { getContext, onMount } from "svelte";

type Step = "current" | "new" | "repeat";

let globalState: GlobalState | undefined = $state(undefined);
let step = $state<Step>("current");
let currentPin = $state("");
let newPin = $state("");
let repeatPin = $state("");
let error = $state<string | null>(null);
let submitting = $state(false);
let showSuccess = $state(false);

const stepPin = $derived(
    step === "current" ? currentPin : step === "new" ? newPin : repeatPin,
);
const canSubmit = $derived(stepPin.length === 4);

const stepTitle = $derived(
    step === "current"
        ? "Enter your current PIN"
        : step === "new"
          ? "Enter your new PIN"
          : "Confirm your new PIN",
);

function advance() {
    if (!canSubmit) return;
    error = null;
    if (step === "current") {
        step = "new";
    } else if (step === "new") {
        step = "repeat";
    } else {
        void submit();
    }
}

async function submit() {
    if (!globalState) return;
    if (repeatPin !== newPin) {
        error = "PIN codes don't match. Try again.";
        repeatPin = "";
        return;
    }
    submitting = true;
    try {
        await globalState.securityController.updatePin(
            newPin,
            repeatPin,
            currentPin,
        );
        showSuccess = true;
    } catch (err) {
        console.error("Failed to update PIN:", err);
        // Most failures here are wrong-current-PIN — bounce back to step 1.
        error = "Couldn't update your PIN. Check your current PIN and try again.";
        step = "current";
        currentPin = "";
        newPin = "";
        repeatPin = "";
    } finally {
        submitting = false;
    }
}

function handleClose() {
    showSuccess = false;
    // /settings/pin is only entered from /settings, so popping history
    // gets us back without leaving an orphan entry that would let the
    // user re-enter the (already-completed) flow with the nav back button.
    window.history.back();
}

// Reset any stale error the moment the user starts typing again.
$effect(() => {
    if (stepPin.length > 0 && error) error = null;
});

$effect(() => {
    runtime.header.title = "Change PIN";
    // Step-aware back: walk back through internal steps before leaving the page.
    runtime.header.onback = () => {
        error = null;
        if (step === "repeat") {
            repeatPin = "";
            step = "new";
        } else if (step === "new") {
            newPin = "";
            step = "current";
        } else {
            window.history.back();
        }
    };
    return () => {
        runtime.header.onback = undefined;
    };
});

onMount(() => {
    globalState = getContext<() => GlobalState>("globalState")();
});
</script>

<main
    use:keyboardInset
    class="h-[calc(100dvh-7rem)] overflow-hidden flex flex-col"
    style="padding-bottom: calc(max(16px, env(safe-area-inset-bottom)) + var(--kb-inset, 0px));"
>
    <section class="flex-1 flex flex-col items-center justify-center gap-4">
        <p class="text-black-700 text-center text-lg">
            {stepTitle}
        </p>

        {#if step === "current"}
            <PinDots bind:pin={currentPin} />
        {:else if step === "new"}
            <PinDots bind:pin={newPin} />
        {:else}
            <PinDots bind:pin={repeatPin} />
        {/if}

        {#if error}
            <p class="text-danger text-sm font-medium text-center" role="alert">
                {error}
            </p>
        {/if}
    </section>

    <footer class="w-full">
        <ButtonAction
            class="w-full uppercase tracking-wide"
            disabled={!canSubmit || submitting}
            callback={advance}
            blockingClick={step === "repeat"}
        >
            {step === "repeat" ? "Change PIN" : "Next"}
        </ButtonAction>
    </footer>
</main>

<BottomSheet bind:isOpen={showSuccess} dismissible={false}>
    <div
        class="relative bg-gray w-18 h-18 rounded-3xl flex justify-center items-center mb-[2.3svh]"
    >
        <span class="relative z-1">
            <HugeiconsIcon
                icon={CircleLock01Icon}
                color="var(--color-primary)"
            />
        </span>
        <img class="absolute top-0 inset-s-0" src="/images/Line.svg" alt="" />
        <img class="absolute top-0 inset-s-0" src="/images/Line2.svg" alt="" />
    </div>
    <h4>PIN code changed!</h4>
    <p class="text-black-700 mt-[0.5svh] mb-[2.3svh]">
        Your PIN has been changed.
    </p>
    <ButtonAction class="w-full" callback={handleClose}>Close</ButtonAction>
</BottomSheet>
