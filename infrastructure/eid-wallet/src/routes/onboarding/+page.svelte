<script lang="ts">
    import ButtonAction from "$lib/ui/Button/ButtonAction.svelte";

    const handleGetStarted = async() => {
        //get started functionality
    }
</script>

<main class="pt-[3vh] px-[6vw] pb-[4.5vh]">
    <article class="flex justify-center mb-[4vh]">
        <img src="/images/Onboarding.svg" alt="card">
    </article>
    <section class="mb-[9.3vh]">
        <h1 class="text-[42px]/[1] text-black font-medium mb-[1vh]">Your <br>
            Digital Identity,
            Secured</h1>
        <p class="text-base text-black-700 font-normal">Store your IDs, verify instantly with QR codes, and manage your digital identity with ease.</p>
    </section>
    <section>
        <p class="max-w-[300px] mx-[auto] text-center text-xs text-black-500">By continuing you agree to our <a href="/" class="text-primary underline underline-offset-5">Terms & Conditions </a> and <a href="/" class="text-primary underline underline-offset-5">privacy policy.</a></p>
        <div class="flex justify-center items-center gap-[11px] whitespace-nowrap mt-[2vh]">
            <ButtonAction class="w-full" callback={handleGetStarted}>Get Started</ButtonAction>
        </div>
    </section>
</main>