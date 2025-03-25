<script lang="ts">
    import { goto } from "$app/navigation";
    import {ButtonAction} from "$lib/ui";
</script>

<main class="h-[100vh] pt-[3vh] px-[6vw] pb-[4.5vh] flex flex-col justify-between items-center">
    <section>
        <h1 class="text-3xl text-black font-semibold">Verify your account</h1>
        <p class="text-base font-normal text-black-700">Get your passport ready. You’ll be directed to a site where you can verify your account in a swift and secure process</p>
    </section>
    <img src="images/Passport.svg" alt="passport">
    <ButtonAction class="w-full" callback={async() => goto("/verify/id")}>I'm ready</ButtonAction>
</main>