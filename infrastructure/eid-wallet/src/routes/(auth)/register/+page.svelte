<script lang="ts">
import { goto } from "$app/navigation";
import { Hero } from "$lib/fragments";
import type { GlobalState } from "$lib/global";
import { ButtonAction, Drawer, InputPin } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import {
    ArrowLeft01Icon,
    CircleLock01Icon,
    FaceIdIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import { checkStatus } from "@tauri-apps/plugin-biometric";
import { getContext, onMount } from "svelte";

let pin = $state("");
let repeatPin = $state("");
let firstStep = $state(true);
let showDrawer = $state(false);
let isBiometricsAvailable = $state(false);
let isBiometricScreen = $state(false);
let isBiometricsAdded = $state(false);
let isError = $state(false);
let btnVariant = $state<"soft" | "solid">("soft");

let globalState: GlobalState | undefined = $state(undefined);

const handleFirstStep = async () => {
    if (pin.length === 4) {
        firstStep = false;
        btnVariant = "solid";
    }
};

let handleConfirm: () => Promise<void> = $state(async () => {});

const handleNext = async () => {
    //handle next logic goes here
    isBiometricScreen = true;
};

const handleSkip = async () => {
    // handle skip biometrics logic goes here
    if (!globalState) return goto("/onboarding");
    globalState.isOnboardingComplete = true;
    goto("/review");
};

let handleSetupBiometrics = $state(async () => {});

const handleBiometricsAdded = async () => {
    //handle logic when biometrics added successfully
    if (!globalState) return goto("/onboarding");
    globalState.isOnboardingComplete = true;
    goto("/review");
};

$effect(() => {
    if (repeatPin && repeatPin.length === 4 && pin === repeatPin)
        isError = false;
});

$effect(() => {
    // First step button
    if (firstStep) {
        btnVariant = pin.length === 4 ? "solid" : "soft";
    } else {
        // Second step button
        if (repeatPin.length === 4 && pin === repeatPin) {
            btnVariant = "solid";
            isError = false;
        } else {
            btnVariant = "soft";
        }
    }
});

onMount(async () => {
    globalState = getContext<() => GlobalState>("globalState")();
    if (!globalState) throw new Error("Global state is not defined");

    try {
        isBiometricsAvailable = (await checkStatus()).isAvailable;
        console.log("isBiometricsAvailable", isBiometricsAvailable);
    } catch (error) {
        isBiometricsAvailable = false;
        console.error("Failed to check biometrics status:", error);
    }

    handleConfirm = async () => {
        if (repeatPin.length < 4) {
            isError = true;
            return;
        }

        if (pin !== repeatPin) {
            isError = true;
            firstStep = true;
            return;
        }

        isError = false;
        try {
            await globalState?.securityController.setOnboardingPin(
                pin,
                repeatPin,
            );
            showDrawer = true;
        } catch (error) {
            console.error("Failed to update PIN:", error);
            isError = true;
        }
    };

    handleSetupBiometrics = async () => {
        if (!globalState)
            throw new Error(
                "Cannot set biometric support, Global state is not defined",
            );
        if (isBiometricsAvailable) {
            try {
                globalState.securityController.biometricSupport = true;
            } catch (error) {
                console.error("Failed to enable biometric support:", error);
                // Consider showing an error message to the user
                return;
            }
        }
        isBiometricsAdded = true;
    };
});
</script>

{#if firstStep}
    <main
        class="h-full pt-[5.2svh] px-[5vw] pb-[4.5svh] flex flex-col justify-between"
    >
        <section>
            <Hero title="Create a PIN" class="mb-[14svh]">
                {#snippet subtitle()}
                    Enter your 4-digit PIN code
                {/snippet}
            </Hero>

            <InputPin bind:pin isError={isError && pin.length === 0} />
            <p
                class={`text-danger mt-[3.4svh] ${isError && pin.length === 0 ? "block" : "hidden"}`}
            >
                Your PIN does not match, try again.
            </p>
        </section>
        <div class="flex items-center gap-3">
            <ButtonAction
                variant="soft"
                class="flex-1"
                callback={() => goto("/onboarding")}>Back</ButtonAction
            >
            <ButtonAction
                class="flex-1"
                variant={btnVariant}
                callback={handleFirstStep}
            >
                Confirm
            </ButtonAction>
        </div>
    </main>
{:else}
    <main
        class="h-full pt-[5.2svh] px-[5vw] pb-[4.5svh] flex flex-col justify-between"
    >
        <section>
            <Hero title="Re-enter your PIN" class="mb-[14svh]">
                {#snippet subtitle()}
                    Confirm by entering PIN again
                {/snippet}
            </Hero>
            <InputPin bind:pin={repeatPin} />
        </section>
        <div class="flex items-center gap-3">
            <ButtonAction
                variant="soft"
                class="flex-1"
                callback={() => goto("/onboarding")}>Back</ButtonAction
            >
            <ButtonAction
                variant={btnVariant}
                class="flex-1"
                callback={handleConfirm}>Confirm</ButtonAction
            >
        </div>
    </main>
{/if}

{#if showDrawer}
    <div class="fixed inset-0 z-50 bg-white overflow-y-auto">
        <div class="min-h-full flex flex-col p-6">
            <article class="grow flex flex-col items-start w-full">
                <div class="flex-none">
                    <button
                        onclick={() => (showDrawer = false)}
                        class="flex items-center gap-2 text-black-500 mb-6 py-2"
                    >
                        <HugeiconsIcon icon={ArrowLeft01Icon} size={24} />
                    </button>
                </div>
                {#if !isBiometricScreen}
                    <div
                        class="relative bg-gray w-[72px] h-[72px] rounded-3xl flex justify-center items-center mb-6"
                    >
                        <span class="relative z-1">
                            <HugeiconsIcon
                                icon={CircleLock01Icon}
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
                    <h4 class="text-xl font-bold">PIN has been set!</h4>
                    <p class="text-black-700 mt-2">
                        Your PIN has been created. You’ll use it to access your
                        digital entity securely.
                    </p>
                {:else}
                    <div
                        class="relative bg-gray w-[72px] h-[72px] rounded-3xl flex justify-center items-center mb-6"
                    >
                        <span class="relative z-1">
                            <HugeiconsIcon
                                icon={FaceIdIcon}
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
                    <h4 class="text-xl font-bold">
                        {isBiometricsAdded
                            ? "You’re all set!"
                            : "Add biometrics"}
                    </h4>
                    <p class="text-black-700 mt-2">
                        {isBiometricsAdded
                            ? "Your biometrics have been successfully added."
                            : "Use your fingerprint or face recognition for faster, more secure logins."}
                    </p>
                {/if}
            </article>

            <div class="flex-none pt-8 pb-4">
                {#if !isBiometricScreen}
                    <div class="flex items-center gap-3">
                        <ButtonAction
                            variant="soft"
                            class="flex-1"
                            callback={() => {
                                showDrawer = false;
                            }}>Back</ButtonAction
                        >
                        <ButtonAction class="flex-1" callback={handleNext}
                            >Next</ButtonAction
                        >
                    </div>
                {:else if !isBiometricsAdded}
                    <div class="flex flex-col gap-3">
                        <div class="flex items-center gap-3">
                            <ButtonAction
                                class="flex-1 bg-primary-100 text-primary"
                                callback={handleSkip}>Skip</ButtonAction
                            >
                            <ButtonAction
                                disabled={!isBiometricsAvailable}
                                class="flex-1"
                                callback={handleSetupBiometrics}
                                >Set up</ButtonAction
                            >
                        </div>
                        {#if !isBiometricsAvailable}
                            <p class="text-danger text-center text-sm">
                                Biometrics unavailable.
                            </p>
                        {/if}
                    </div>
                {:else}
                    <div class="flex items-center gap-3">
                        <ButtonAction
                            variant="soft"
                            class="flex-1"
                            callback={() => {
                                showDrawer = false;
                            }}>Back</ButtonAction
                        >
                        <ButtonAction
                            class="flex-1"
                            callback={handleBiometricsAdded}
                        >
                            Continue
                        </ButtonAction>
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}
