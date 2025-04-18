<script lang="ts">
    import { goto } from "$app/navigation";
    import { Hero } from "$lib/fragments";
    import type { GlobalState } from "$lib/global";
    import { InputPin } from "$lib/ui";
    import * as Button from "$lib/ui/Button"
    import { getContext, onMount } from "svelte";

    let pin = $state("");
    let isError = $state(false);
    let clearPin = $state(async() => {})
    let handlePinInput = $state((pin: string) => {})
    let globalState: GlobalState | undefined = $state(undefined);
    let cleared = $state(false)

    onMount(async () => {
        globalState = getContext<() => GlobalState>("globalState")();
        if (!globalState) throw new Error("Global state is not defined");

        clearPin = async () => {
            await globalState?.securityController.clearPin()
            cleared = true
            goto("/")
        }

        handlePinInput = async (pin: string) => {
            console.log("ran")
            if (pin.length === 4) {
                isError = false;
                const check = await globalState?.securityController.verifyPin(pin);
                if (!check) {
                    isError = true;
                    return
                }
                await goto("/main")
            }
        }

        $effect(() => {
            handlePinInput(pin)
        })
    })

</script>

<main class="h-screen pt-[5.2vh] px-[5vw] pb-[4.5vh] flex flex-col justify-between">
    <section>
        <Hero
        title="Log in to your account"
        subtitle="Enter your 4-digit PIN code"
        class="mb-4"
        />
        <InputPin variant="sm" bind:pin isError={isError} />
        <p class={`text-danger mt-[3.4vh] ${isError ? "block" : "hidden"}`}>Your PIN does not match, try again.</p>
    </section>
    <Button.Action class={`w-full`} variant="danger" callback={clearPin}>
        Clear Pin
    </Button.Action>
</main>
