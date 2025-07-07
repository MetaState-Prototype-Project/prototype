<script lang="ts">
    import { goto } from "$app/navigation";
    import { Hero } from "$lib/fragments";
    import IdentityCard from "$lib/fragments/IdentityCard/IdentityCard.svelte";
    import type { GlobalState } from "$lib/global";
    import { ButtonAction } from "$lib/ui";
    import { getContext, onMount } from "svelte";

    let userData = $state();
    let globalState: GlobalState =
        getContext<() => GlobalState>("globalState")();

    const handleFinish = async () => {
        await goto("/main");
    };

    onMount(async () => {
        const userInfo = await globalState.userController.user;
        const isFake = await globalState.userController.isFake;
        userData = { ...userInfo, isFake };
    });
</script>

<main
    class="h-full pt-[5.2svh] px-[5vw] pb-[4.5svh] flex flex-col justify-between"
>
    <section>
        <Hero title="Here’s your ePassport" class="mb-2">
            {#snippet subtitle()}
                <p>
                    You can use it to access any platform that supports the Web
                    3.0 Data Space – <strong>no usernames, no passwords</strong
                    >. If you lose your phone, you can reissue your ePassport on
                    another device, linked to the same <strong>eName</strong>.
                </p>
            {/snippet}
        </Hero>
        <IdentityCard variant="ePassport" {userData} />
    </section>
    <section class="mt-[2svh] mb-[3svh]">
        <Hero title="Here’s your eVault" class="mb-2">
            {#snippet subtitle()}
                The eVault is your secure cloud storage for your personal data.
                W3DS platforms access it directly, keeping you in control.
            {/snippet}
        </Hero>

        <IdentityCard variant="eVault" usedStorage={0.1} totalStorage={10} />
    </section>
    <ButtonAction class="w-full" callback={handleFinish}>Finish</ButtonAction>
</main>
