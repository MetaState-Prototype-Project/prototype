<script lang="ts">
    import { goto } from "$app/navigation";
    import { Hero } from "$lib/fragments";
    import { GlobalState } from "$lib/global";
    import { ButtonAction } from "$lib/ui";
    import { getContext, onMount } from "svelte";
    import Drawer from "$lib/ui/Drawer/Drawer.svelte";
    import axios from "axios";
    import { PUBLIC_PROVISIONER_URL } from "$env/static/public";
    import { verifStep } from "./store";
    import Passport from "./steps/passport.svelte";
    import Selfie from "./steps/selfie.svelte";

    let globalState: GlobalState | undefined = $state(undefined);
    let showVeriffModal = $state(false);

    async function handleVerification() {
        const { data } = await axios.post(
            new URL("/idv", PUBLIC_PROVISIONER_URL).toString(),
        );
        console.log(data);
        showVeriffModal = true;
    }

    onMount(() => {
        globalState = getContext<() => GlobalState>("globalState")();
        // handle verification logic + set user data in the store

        // handleVerification = async () => {
        //     if (!globalState) throw new Error("Global state is not defined");
        //     globalState.userController.user = {
        //         name: "John Doe",
        //         "Date of Birth": "01/01/2000",
        //         "ID submitted": "American Passport",
        //         "Passport Number": "1234567-US",
        //     };
        //     await goto("/register");
        // };
    });
</script>

<main
    class="pt-[3svh] px-[5vw] pb-[4.5svh] flex flex-col justify-between items-center"
>
    <section>
        <Hero
            title="Verify your account"
            subtitle="Get your passport ready. You’ll be directed to a site where you can verify your account in a swift and secure process"
        />
        <img class="mx-auto mt-20" src="images/Passport.svg" alt="passport" />
    </section>
    <ButtonAction class="w-full mt-10" callback={handleVerification}
        >I'm ready</ButtonAction
    >
    <Drawer bind:isPaneOpen={showVeriffModal}>
        {#if $verifStep === 0}
            <Passport></Passport>
        {:else if $verifStep === 1}
            <Selfie></Selfie>
        {/if}
    </Drawer>
</main>
