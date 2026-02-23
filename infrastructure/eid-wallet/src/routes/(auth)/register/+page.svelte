<script lang="ts">
import { goto } from "$app/navigation";
import { Hero } from "$lib/fragments";
import type { GlobalState } from "$lib/global";
import { pendingRecovery } from "$lib/stores/pendingRecovery";
import { ButtonAction, InputPin } from "$lib/ui";
import { CircleLock01Icon, FaceIdIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import { checkStatus } from "@tauri-apps/plugin-biometric";
import { get } from "svelte/store";
import { getContext, onMount } from "svelte";

type Step = "CREATE" | "REPEAT" | "PIN_DONE" | "BIOMETRICS" | "ALL_SET";
let currentStep = $state<Step>("CREATE");

let pin = $state("");
let repeatPin = $state("");
let isBiometricsAvailable = $state(false);
let isError = $state(false);
let btnVariant = $state<"soft" | "solid">("soft");
let globalState: GlobalState | undefined = $state(undefined);

const handleBack = () => {
    if (currentStep === "REPEAT") {
        currentStep = "CREATE";
        repeatPin = "";
    } else if (currentStep === "PIN_DONE") {
        currentStep = "REPEAT";
    } else if (currentStep === "ALL_SET") {
        currentStep = "BIOMETRICS";
    } else {
        goto("/onboarding");
    }
};

const handleConfirmFirst = () => {
    if (pin.length === 4) currentStep = "REPEAT";
};

const handleConfirmRepeat = async () => {
    if (repeatPin.length !== 4) return;

    if (pin !== repeatPin) {
        isError = true;
        currentStep = "CREATE";
        pin = "";
        repeatPin = "";
        return;
    }

    if (!globalState) {
        console.error("Global state not available; cannot set onboarding PIN.");
        isError = true;
        currentStep = "CREATE";
        pin = "";
        repeatPin = "";
        return;
    }

    try {
        isError = false;
        await globalState?.securityController.setOnboardingPin(pin, repeatPin);
        currentStep = "PIN_DONE";
    } catch (error) {
        console.error("Failed to update PIN:", error);
        currentStep = "CREATE";
        pin = "";
        repeatPin = "";
        isError = true;
    }
};

const handleSetupBiometrics = async () => {
    if (isBiometricsAvailable && globalState) {
        globalState.securityController.biometricSupport = true;
        currentStep = "ALL_SET";
    }
};

const finishOnboarding = async () => {
    if (!globalState) return goto("/onboarding");

    const recovery = get(pendingRecovery);
    if (recovery) {
        globalState.userController.isFake = false;
        globalState.userController.user = recovery.user as any;
        globalState.userController.document = recovery.document as any;
        // vault is NOT set here — deferred to e-passport handleFinish
        // pendingRecovery is cleared there too
    }

    globalState.isOnboardingComplete = true;
    goto("/review");
};

$effect(() => {
    if (currentStep === "CREATE")
        btnVariant = pin.length === 4 ? "solid" : "soft";
    else if (currentStep === "REPEAT")
        btnVariant = repeatPin.length === 4 ? "solid" : "soft";
});

onMount(async () => {
    globalState = getContext<() => GlobalState>("globalState")();
    try {
        isBiometricsAvailable = (await checkStatus()).isAvailable;
    } catch (e) {
        isBiometricsAvailable = false;
    }
});
</script>

<main
    class="h-full px-[5vw] pb-[8svh] flex flex-col justify-between"
    style="padding-top: max(5.2svh, env(safe-area-inset-top));"
>
    <section>
        {#if currentStep === "CREATE"}
            <Hero title="Create a PIN" class="mb-[14svh]">
                {#snippet subtitle()}
                    Enter your 4-digit PIN code
                {/snippet}
            </Hero>
            <InputPin bind:pin isError={isError && pin.length === 0} />
            {#if isError}<p class="text-danger mt-4 text-center">
                    PINs didn't match. Try again.
                </p>{/if}
        {:else if currentStep === "REPEAT"}
            <Hero title="Re-enter your PIN" class="mb-[14svh]">
                {#snippet subtitle()}
                    Confirm by entering PIN again
                {/snippet}
            </Hero>
            <InputPin bind:pin={repeatPin} />
        {:else}
            <article class="flex flex-col items-start w-full mt-[4svh]">
                <div
                    class="relative bg-gray w-[72px] h-[72px] rounded-3xl flex justify-center items-center mb-6"
                >
                    <span class="relative z-1">
                        <HugeiconsIcon
                            icon={currentStep === "PIN_DONE"
                                ? CircleLock01Icon
                                : FaceIdIcon}
                            color="var(--color-primary)"
                        />
                    </span>
                    <img
                        class="absolute top-0 start-0"
                        src="/images/Line.svg"
                        alt="line"
                    />
                    <img
                        class="absolute top-0 start-0"
                        src="/images/Line2.svg"
                        alt="line"
                    />
                </div>

                {#if currentStep === "PIN_DONE"}
                    <h4 class="text-xl font-bold">PIN has been set!</h4>
                    <p class="text-black-700 mt-2">
                        Your PIN has been created. You'll use it to access your
                        digital entity securely.
                    </p>
                {:else if currentStep === "BIOMETRICS"}
                    <h4 class="text-xl font-bold">Add biometrics</h4>
                    <p class="text-black-700 mt-2">
                        Use your fingerprint or face recognition for faster,
                        more secure logins.
                    </p>
                {:else}
                    <h4 class="text-xl font-bold">You're all set!</h4>
                    <p class="text-black-700 mt-2">
                        Your biometrics have been successfully added.
                    </p>
                {/if}
            </article>
        {/if}
    </section>

    <footer class="w-full flex flex-col gap-3">
        {#if currentStep === "BIOMETRICS"}
            <ButtonAction
                class="w-full"
                disabled={!isBiometricsAvailable}
                callback={handleSetupBiometrics}
            >
                Set up Biometrics
            </ButtonAction>
            <ButtonAction variant="soft" class="w-full" callback={finishOnboarding}>
                Skip
            </ButtonAction>
            {#if !isBiometricsAvailable}
                <p class="text-danger text-center text-sm">
                    Biometrics unavailable on this device.
                </p>
            {/if}
        {:else if currentStep === "CREATE"}
            <ButtonAction class="w-full" variant={btnVariant} callback={handleConfirmFirst}>
                Confirm
            </ButtonAction>
        {:else if currentStep === "REPEAT"}
            <ButtonAction class="w-full" variant={btnVariant} callback={handleConfirmRepeat}>
                Confirm
            </ButtonAction>
            <ButtonAction variant="soft" class="w-full" callback={handleBack}>Back</ButtonAction>
        {:else if currentStep === "PIN_DONE"}
            <ButtonAction class="w-full" callback={() => { currentStep = "BIOMETRICS"; }}>
                Next
            </ButtonAction>
            <ButtonAction variant="soft" class="w-full" callback={handleBack}>Back</ButtonAction>
        {:else if currentStep === "ALL_SET"}
            <ButtonAction class="w-full" callback={finishOnboarding}>Continue</ButtonAction>
        {/if}
    </footer>
</main>
