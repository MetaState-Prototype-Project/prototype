<script lang="ts">
import { goto } from "$app/navigation";
import { Hero } from "$lib/fragments";
import type { GlobalState } from "$lib/global";
import { InputPin } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import {
    type AuthOptions,
    authenticate,
    checkStatus,
} from "@tauri-apps/plugin-biometric";
import { getContext, onMount } from "svelte";

let pin = $state("");
let isError = $state(false);
let clearPin = $state(async () => {});
let handlePinInput = $state((pin: string) => {});
let globalState: GlobalState | undefined = $state(undefined);

const authOpts: AuthOptions = {
    allowDeviceCredential: false,

    cancelTitle: "Cancel",

    // iOS
    fallbackTitle: "Please enter your PIN",

    // Android
    title: "Login",
    subtitle: "Please authenticate to continue",
    confirmationRequired: true,
};

onMount(async () => {
    globalState = getContext<() => GlobalState>("globalState")();
    if (!globalState) {
        console.error("Global state is not defined");
        await goto("/"); // Redirect to home or error page
        return;
    }

    clearPin = async () => {
        await globalState?.securityController.clearPin();
        goto("/");
    };

    handlePinInput = async (pin: string) => {
        if (pin.length === 4) {
            isError = false;
            const check = globalState
                ? await globalState.securityController.verifyPin(pin)
                : false;
            if (!check) {
                isError = true;
                return;
            }
            await goto("/main");
        }
    };

    // for some reason it's important for this to be done before the biometric stuff
    // otherwise pin doesn't work
    $effect(() => {
        handlePinInput(pin);
    });

    if (
        (await globalState.securityController.biometricSupport) &&
        (await checkStatus()).isAvailable
    ) {
        try {
            await authenticate(
                "You must authenticate with PIN first",
                authOpts,
            );
            await goto("/main");
        } catch (e) {
            console.error("Biometric authentication failed", e);
        }
    }
});
</script>

<main
    class="h-full pt-[5.2svh] px-[5vw] pb-[4.5svh] flex flex-col justify-between"
>
    <section>
        <Hero title="Log in to your account" class="mb-4">
            {#snippet subtitle()}
                Enter your 4-digit PIN code
            {/snippet}
        </Hero>
        <InputPin bind:pin {isError} onchange={() => handlePinInput(pin)} />
        <p class={`text-danger mt-[3.4svh] ${isError ? "block" : "hidden"}`}>
            Your PIN does not match, try again.
        </p>
    </section>
    <Button.Action class={`w-full`} variant="danger" callback={clearPin}>
        Clear PIN
    </Button.Action>
</main>
