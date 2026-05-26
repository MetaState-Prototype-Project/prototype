<script lang="ts">
import { keyboardInset } from "$lib/actions/keyboardInset";
import { ButtonAction } from "$lib/ui";
import { FaceIdIcon, FingerPrintIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import { checkStatus } from "@tauri-apps/plugin-biometric";
import { onMount } from "svelte";
import StepHeader from "./StepHeader.svelte";

interface IBiometricsSetupProps {
    /** Fired when the back chevron is tapped. */
    onback?: () => void;
    /** Fired when the user chooses to enable biometrics. May return a Promise —
     *  the button shows a loading state until it settles. */
    onenable?: () => Promise<void> | void;
    /** Fired when the user skips this step. */
    onskip?: () => void;
}

const { onback, onenable, onskip }: IBiometricsSetupProps = $props();

let isAvailable = $state<boolean | null>(null);

onMount(async () => {
    try {
        const status = await checkStatus();
        isAvailable = status.isAvailable;
    } catch {
        isAvailable = false;
    }
});

const handleEnable = async () => {
    if (!isAvailable) return;
    await onenable?.();
};
</script>

<main
    use:keyboardInset
    class="h-dvh overflow-hidden px-[5vw] flex flex-col bg-white"
    style="padding-top: max(2svh, env(safe-area-inset-top)); padding-bottom: calc(max(16px, env(safe-area-inset-bottom)) + var(--kb-inset, 0px));"
>
    <StepHeader title="Add biometrics" step={3} {onback} />

    <section class="flex-1 flex flex-col items-center justify-center gap-8">
        <div
            class="relative bg-gray w-24 h-24 rounded-3xl flex justify-center items-center"
        >
            <span class="relative z-1">
                <HugeiconsIcon
                    icon={FaceIdIcon}
                    size={44}
                    color="var(--color-primary)"
                />
            </span>
            <img
                class="absolute top-0 start-0"
                src="/images/Line.svg"
                alt=""
                aria-hidden="true"
            />
            <img
                class="absolute top-0 start-0"
                src="/images/Line2.svg"
                alt=""
                aria-hidden="true"
            />
        </div>

        <div class="text-center max-w-xs">
            <h4 class="text-xl font-bold mb-2">Faster, safer sign-in</h4>
            <p class="text-black-700 text-sm">
                Use your fingerprint or face to unlock the app instead of typing
                your PIN every time.
            </p>
        </div>

        {#if isAvailable === false}
            <p class="text-black-500 text-sm text-center px-4">
                Biometrics aren't available on this device — you can continue
                with just your PIN.
            </p>
        {/if}
    </section>

    <footer class="w-full flex flex-col gap-3">
        <ButtonAction
            class="w-full uppercase tracking-wide"
            disabled={!isAvailable}
            callback={handleEnable}
            blockingClick={true}
        >
            <span class="flex items-center justify-center gap-2">
                <HugeiconsIcon
                    icon={FingerPrintIcon}
                    size={18}
                    color="currentColor"
                />
                Enable Biometrics
            </span>
        </ButtonAction>
        <ButtonAction
            variant="soft"
            class="w-full uppercase tracking-wide"
            callback={() => onskip?.()}
        >
            Skip for now
        </ButtonAction>
    </footer>
</main>
