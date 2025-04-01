<script lang="ts">
import { goto } from "$app/navigation";
import { Hero } from "$lib/fragments";
import { ButtonAction, Drawer } from "$lib/ui";

let isPaneOpen = $state(false);

const handleGetStarted = async () => {
	//get started functionality
	isPaneOpen = true;
};

const handleNext = async () => {
	//handle next functionlity
	goto("/verify");
};
</script>

<main class="pt-[3vh] px-[5vw] pb-[4.5vh]">
    <article class="flex justify-center mb-[4vh]">
        <img class="aspect-square w-full object-cover" src="/images/Onboarding.svg" alt="Infographic card">
    </article>
    <section class="mb-[9.3vh]">
        <Hero
        subtitle="Store your IDs, verify instantly with QR codes, and manage your digital identity with ease."
        class="mb-4"
        titleClasses="text-[42px]/[1.1] font-medium"
        >
            Your <br>
            Digital Identity,
            Secured
        </Hero>
    </section>
    <section>
        <p class="max-w-[300px] mx-[auto] text-center small text-black-500">By continuing you agree to our <a href="/" class="text-primary underline underline-offset-5">Terms & Conditions </a> and <a href="/" class="text-primary underline underline-offset-5">privacy policy.</a></p>
        <div class="flex justify-center whitespace-nowrap mt-[2vh]">
            <ButtonAction class="w-full" callback={handleGetStarted}>Get Started</ButtonAction>
        </div>
    </section>
</main>

<Drawer bind:isPaneOpen>
    <img src="/images/GetStarted.svg" alt="get-started">
    <h4 class="mt-[2.3vh] mb-[0.5vh]">Welcome to Web 3 Data Spaces</h4>
    <p class="text-black-700">Your eName is more than a name—it's your unique digital passport. One constant identifier that travels with you across the internet, connecting your real-world self to the digital universe.</p>
    <div class="flex justify-center whitespace-nowrap my-[2.3vh]">
        <ButtonAction class="w-full" callback={handleNext}>Next</ButtonAction>
    </div>
</Drawer>