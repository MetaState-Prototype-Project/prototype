<script lang="ts">
import { goto } from "$app/navigation";
import { Hero } from "$lib/fragments";
import type { GlobalState } from "$lib/global";
import { ButtonAction, Drawer, InputPin } from "$lib/ui";
import { CircleLock01Icon, FaceIdIcon } from "@hugeicons/core-free-icons";
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

let globalState: GlobalState | undefined = $state(undefined);

const handleFirstStep = async () => {
    if (pin.length === 4) firstStep = false;
};

let handleConfirm: () => Promise<void> = $state(async () => {});

const handleNext = async () => {
    //handle next logic goes here
    isBiometricScreen = true;
};

const handleSkip = async () => {
    // handle skip biometics logic goes here
    goto("/review");
};

let handleSetupBiometrics = $state(async () => {});

const handleBiometricsAdded = async () => {
    //handle logic when biometrics added successfully
    goto("/review");
};

$effect(() => {
    if (repeatPin && repeatPin.length === 4 && pin === repeatPin)
        isError = false;
});

onMount(async () => {
    globalState = getContext<() => GlobalState>("globalState")();
    if (!globalState) throw new Error("Global state is not defined");

    isBiometricsAvailable = (await checkStatus()).isAvailable;
    console.log("isBiometricsAvailable", isBiometricsAvailable);

    handleConfirm = async () => {
        //confirm pin logic goes here
        if (repeatPin && repeatPin.length === 4 && pin !== repeatPin) {
            firstStep = true;
            isError = true;
        } else {
            isError = false;
            showDrawer = true;
            await globalState?.securityController.updatePin(pin, repeatPin);
            return;
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
        <ButtonAction class="w-full" variant="soft" callback={handleFirstStep}>
            Confirm
        </ButtonAction>
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
        <ButtonAction class="w-full" callback={handleConfirm}
            >Confirm</ButtonAction
        >
    </main>
{/if}

<Drawer bind:isPaneOpen={showDrawer}>
    {#if !isBiometricScreen}
        <div
            class="relative bg-gray w-[72px] h-[72px] rounded-[24px] flex justify-center items-center mb-[2.3svh]"
        >
            <span class="relative z-[1]">
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
        <h4>PIN has been set!</h4>
        <p class="text-black-700 mt-[0.5svh] mb-[2.3svh]">
            Your PIN has been created. You’ll use it to access your digital
            entity securely.
        </p>
        <ButtonAction class="w-full" callback={handleNext}>Next</ButtonAction>
    {:else}
        <div
            class="relative bg-gray w-[72px] h-[72px] rounded-[24px] flex justify-center items-center mb-[2.3svh]"
        >
            <span class="relative z-[1]">
                <HugeiconsIcon icon={FaceIdIcon} color="var(--color-primary)" />
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
        <h4>{isBiometricsAdded ? "You’re all set!" : "Add biometrics"}</h4>
        <p class="text-black-700 mt-[0.5svh] mb-[2.3svh]">
            {isBiometricsAdded
                ? "Your biometrics have been successfully added."
                : "Use your fingerprint or face recognition for faster, more secure logins."}
        </p>
        {#if !isBiometricsAdded}
            <div class="flex justify-center items-center gap-[11px]">
                <ButtonAction
                    class="w-full bg-primary-100 text-primary"
                    callback={handleSkip}>Skip</ButtonAction
                >
                <div class="flex w-full flex-col gap-2">
                    <ButtonAction
                        disabled={!isBiometricsAvailable}
                        class="w-full"
                        callback={handleSetupBiometrics}>Set up</ButtonAction
                    >
                    <p
                        class={`text-danger ${isBiometricsAvailable ? "hidden" : "block"}`}
                    >
                        Biometrics unavailable.
                    </p>
                </div>
            </div>
        {:else}
            <ButtonAction class="w-full" callback={handleBiometricsAdded}
                >Continue</ButtonAction
            >
        {/if}
    {/if}
</Drawer>
