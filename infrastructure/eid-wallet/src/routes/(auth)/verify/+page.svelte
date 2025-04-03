<script lang="ts">
import { goto } from "$app/navigation";
import { Hero } from "$lib/fragments";
import { ButtonAction } from "$lib/ui";
</script>

<main class="h-screen pt-[3vh] px-[5vw] pb-[4.5vh] flex flex-col justify-between items-center">
    <section>
        <Hero
            title="Verify your account"
            subtitle="Get your passport ready. You’ll be directed to a site where you can verify your account in a swift and secure process"
        />
        <img class="mx-auto mt-20" src="images/Passport.svg" alt="passport">
    </section>
    <ButtonAction class="w-full" callback={async() => goto("/register")}>I'm ready</ButtonAction>
</main>