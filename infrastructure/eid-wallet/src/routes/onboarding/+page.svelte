<script lang="ts">
    import ButtonAction from "$lib/ui/Button/ButtonAction.svelte";

    const handleLogin = async() => {
        // login fucntionality
    }

    const handleGetStarted = async() => {
        //get started functionality
    }
</script>

<main class="pt-[3vh] px-[6vw]">
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
        <p>By continuing you agree to our <a href="/">Terms & Conditions </a> and <a href="/">privacy policy.</a></p>
        <div class="grid grid-cols-2 items-center gap-[11px] whitespace-nowrap mt-[1.2vh]">
            <ButtonAction cb={handleLogin}>Log in</ButtonAction>
            <ButtonAction cb={handleGetStarted}>Get Started</ButtonAction>
        </div>
    </section>
</main>