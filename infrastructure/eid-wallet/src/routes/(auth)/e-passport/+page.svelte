<script lang="ts">
import { goto } from "$app/navigation";
import { Hero } from "$lib/fragments";
import IdentityCard from "$lib/fragments/IdentityCard/IdentityCard.svelte";
import type { GlobalState } from "$lib/global";
import { ButtonAction } from "$lib/ui";
import { getContext, onMount } from "svelte";

let userData = $state();
let globalState: GlobalState = getContext<() => GlobalState>("globalState")();

const handleFinish = async () => {
    await goto("/main");
};

onMount(async () => {
    userData = await globalState.userController.user;
});
</script>

<main
    class="h-[max-content] pt-[5.2svh] px-[5vw] pb-[4.5svh] flex flex-col justify-between"
>
    <section>
        <Hero
            title="Your ePassport and eVault are ready"
            subtitle="Log into any W3DS platform without passwords. It’s tied to this phone; if lost, you’ll need to revoke and reissue it on a new device."
            class="mb-2"
        />
        <IdentityCard variant="ePassport" {userData} />
    </section>
    <section class="mt-[4svh] mb-[9svh]">
        <h4>Your eVault</h4>
        <p class="text-black-700 mb-[1svh]">
            We’ve also created your eVault—secure cloud storage for your
            personal data. W3DS platforms access it directly, keeping you in
            control.
        </p>
        <IdentityCard variant="eVault" usedStorage={0.1} totalStorage={10} />
    </section>
    <ButtonAction class="w-full" callback={handleFinish}>Finish</ButtonAction>
</main>
