<script lang="ts">
    import { runtime } from "$lib/global/runtime.svelte";
    import { ButtonAction, Drawer, InputPin } from "$lib/ui";
    import { CircleLock01Icon } from "@hugeicons/core-free-icons";
    import { HugeiconsIcon } from "@hugeicons/svelte";

    let currentPin = $state("");
    let newPin = $state("");
    let repeatPin = $state("");
    let isError = $state(false);
    let showDrawer = $state(false);

    const handleClose = async () => {
        // close functionality goes here.
        showDrawer = false;
    };

    const handleChangePIN = async () => {
        if (repeatPin.length === 4 && newPin !== repeatPin) isError = true;
        if (!isError) showDrawer = true;
    };

    $effect(() => {
        runtime.header.title = "Change PIN";
        if (repeatPin.length === 4 && newPin === repeatPin) isError = false;
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
