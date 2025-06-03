<script lang="ts">
    import { goto } from "$app/navigation";
    import { Hero, IdentityCard } from "$lib/fragments";
    import type { GlobalState } from "$lib/global";
    import { ButtonAction } from "$lib/ui";
    import axios from "axios";
    import { getContext, onMount } from "svelte";

    let globalState = getContext<() => GlobalState>("globalState")();
    let ename = $state();

    const handleNext = async () => {
        await goto("/e-passport");
    };

    onMount(async () => {
        const vault = await globalState.vaultController.vault;
        ename = vault.ename;
    });
</script>

<main
    class="h-screen pt-[5.2svh] px-[5vw] pb-[4.5svh] flex flex-col justify-between"
>
    <section>
        <Hero
            title="Here’s your eName"
            subtitle="This identifier is permanently yours, and it stays with you for your whole life."
            class="mb-4"
        />
        <IdentityCard variant="eName" userId={`${ename ?? "Loading..."}`} />
    </section>
    <ButtonAction class="w-full" callback={handleNext}>Next</ButtonAction>
</main>

