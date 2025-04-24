<script lang="ts">
import { goto } from "$app/navigation";
import { Hero } from "$lib/fragments";
import { GlobalState } from "$lib/global";
import { ButtonAction } from "$lib/ui";
import { getContext, onMount } from "svelte";

let globalState: GlobalState | undefined = $state(undefined);

let handleVerification: () => Promise<void>;

onMount(() => {
    globalState = getContext<() => GlobalState>("globalState")();
    // handle verification logic + set user data in the store
    handleVerification = async () => {
        if (!globalState) throw new Error("Global state is not defined");
        globalState.userController.user = {
            name: "John Doe",
            "Date of Birth": "01/01/2000",
            "ID submitted": "American Passport",
            "Passport Number": "1234567-US",
        };
        await goto("/register");
    };
});
</script>

<main class="h-screen pt-[3vh] px-[5vw] pb-[4.5vh] flex flex-col justify-between items-center">
    <section>
        <Hero
            title="Verify your account"
            subtitle="Get your passport ready. You’ll be directed to a site where you can verify your account in a swift and secure process"
        />
        <img class="mx-auto mt-20" src="images/Passport.svg" alt="passport">
    </section>
    <ButtonAction class="w-full" callback={async() => {
            try {
                await handleVerification();
            } catch (error) {
                console.error("Verification failed:", error);
                // Consider adding user-facing error handling here
            }
        }}>I'm ready</ButtonAction>
</main>
