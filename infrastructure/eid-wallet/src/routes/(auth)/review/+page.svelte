<script lang="ts">
import { goto } from "$app/navigation";
import { Hero, IdentityCard } from "$lib/fragments";
import type { GlobalState } from "$lib/global";
import { pendingRecovery } from "$lib/stores/pendingRecovery";
import { ButtonAction } from "$lib/ui";
import axios from "axios";
import { getContext, onMount } from "svelte";
import { get } from "svelte/store";

let globalState = getContext<() => GlobalState>("globalState")();
let ename = $state();

const handleNext = async () => {
    await goto("/e-passport");
};

onMount(async () => {
    const recovery = get(pendingRecovery);
    if (recovery) {
        ename = recovery.ename;
        return;
    }
    const vault = await globalState.vaultController.vault;
    ename = vault?.ename;
});
</script>

<main
    class="min-h-[100svh] px-[5vw] flex flex-col justify-between"
    style="padding-top: max(5.2svh, env(safe-area-inset-top)); padding-bottom: max(16px, env(safe-area-inset-bottom));"
>
    <section>
        <Hero title="Here’s your eName" class="mb-4">
            {#snippet subtitle()}
                This identifier is permanently yours, and it stays with you for
                your whole life.
            {/snippet}
        </Hero>
        <IdentityCard variant="eName" userId={`${ename ?? "Loading..."}`} />
    </section>
    <ButtonAction class="w-full mt-auto" callback={handleNext}>Next</ButtonAction>
</main>
