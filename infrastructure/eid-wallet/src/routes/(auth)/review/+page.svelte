<script lang="ts">
import { goto } from "$app/navigation";
import { Hero, IdentityCard } from "$lib/fragments";
import { ButtonAction } from "$lib/ui";

const handleNext = async () => {
    await goto("/e-passport");
};
</script>

<main class="h-screen pt-[5.2vh] px-[5vw] pb-[4.5vh] flex flex-col justify-between">
    <section>
        <Hero
            title="Here’s your eName"
            subtitle="This identifier is permanently yours, and it stays with you for your whole life."
            class="mb-4"
        />
        <IdentityCard variant="eName" userId= "acbsdjk-14n14k43-12412"/>
    </section>
    <ButtonAction class="w-full" callback={handleNext}>Next</ButtonAction>
</main>