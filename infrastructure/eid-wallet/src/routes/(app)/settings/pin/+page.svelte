<script lang="ts">
import { goto } from "$app/navigation";
import type { GlobalState } from "$lib/global";
import { runtime } from "$lib/global/runtime.svelte";
import { ButtonAction, Drawer, InputPin } from "$lib/ui";
import { CircleLock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import { getContext, onMount } from "svelte";

let globalState: GlobalState | undefined = $state(undefined);
let currentPin = $state("");
let newPin = $state("");
let repeatPin = $state("");
let isError = $state(false);
let showDrawer = $state(false);

const handleClose = async () => {
    // close functionality goes here.
    showDrawer = false;
    goto("/settings");
};

const handleChangePIN = async () => {
    if (newPin.length < 4 || repeatPin.length < 4 || currentPin.length < 4) {
        isError = true;
        return;
    }

    if (newPin !== repeatPin) {
        isError = true;
        return;
    }

    try {
        await globalState?.securityController.updatePin(
            newPin,
            repeatPin,
            currentPin,
        );
        isError = false;
        showDrawer = true;
    } catch (err) {
        console.error("Failed to update PIN:", err);
        isError = true;
    }
};

$effect(() => {
    runtime.header.title = "Change PIN";
    if (repeatPin.length === 4 && newPin === repeatPin) isError = false;
});

onMount(() => {
    globalState = getContext<() => GlobalState>("globalState")();
    if (!globalState) throw new Error("Global state is not defined");
});
</script>

<main
    class="h-[85vh] pt-[4svh] px-[5vw] pb-[4.5svh] flex flex-col justify-between"
>
    <section>
        <div>
            <p class="mb-[1svh]">Enter you current PIN</p>
            <InputPin bind:pin={currentPin} variant="sm" />
        </div>
        <div>
            <p class="mb-[1svh]">Enter your new PIN</p>
            <InputPin bind:pin={newPin} {isError} variant="sm" />
        </div>
        <div>
            <p class="mb-[1svh]">Confirm new PIN</p>
            <InputPin bind:pin={repeatPin} {isError} variant="sm" />
        </div>
        <p class={`text-danger mt-[3.4svh] ${isError ? "block" : "hidden"}`}>
            Your PIN does not match, try again.
        </p>
    </section>
    <ButtonAction class="w-full" callback={handleChangePIN}
        >Change PIN</ButtonAction
    >
</main>

<Drawer bind:isPaneOpen={showDrawer}>
    <div
        class="relative bg-gray w-[72px] h-[72px] rounded-[24px] flex justify-center items-center mb-[2.3svh]"
    >
        <span class="relative z-[1]">
            <HugeiconsIcon
                icon={CircleLock01Icon}
                color="var(--color-primary)"
            />
        </span>
        <img class="absolute top-0 start-0" src="/images/Line.svg" alt="line" />
        <img
            class="absolute top-0 start-0"
            src="/images/Line2.svg"
            alt="line"
        />
    </div>
    <h4>PIN code changed!</h4>
    <p class="text-black-700 mt-[0.5svh] mb-[2.3svh]">
        Your PIN has been changed.
    </p>
    <ButtonAction class="w-full" callback={handleClose}>Close</ButtonAction>
</Drawer>
