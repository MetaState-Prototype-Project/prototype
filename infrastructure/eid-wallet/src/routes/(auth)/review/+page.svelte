<script lang="ts">
import { goto } from "$app/navigation";
import { IdentityCard } from "$lib/fragments";
import { ButtonAction } from "$lib/ui";

const handleNext = async () => {
	await goto("/e-passport");
};
</script>

<main class="h-[100vh] pt-[5.2vh] px-[5vw] pb-[4.5vh] flex flex-col justify-between">
    <section>
        <h3 class="mb-[0.5vh]">Here’s your eName</h3>
        <p class="text-black-700  mb-[3vh]">This identifier is permanently yours, and it stays with you for your whole life.</p>
        
        <IdentityCard variant="eName" userId= "acbsdjk-14n14k43-12412" shareBtn={() => null}  viewBtn={() => null}/>
    </section>
    <ButtonAction class="w-full" callback={handleNext}>Next</ButtonAction>
</main>