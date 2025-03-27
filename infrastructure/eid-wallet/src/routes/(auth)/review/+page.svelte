<script lang="ts">
import { goto } from "$app/navigation";
import { IdentifierCard } from "$lib/fragments";
import { ButtonAction } from "$lib/ui";

const handleNext = async () => {
	await goto("/e-passport");
};
</script>

<main class="h-[100vh] pt-[5.2vh] px-[2.3vw] pb-[4.5vh] flex flex-col justify-between">
    <section>
        <h1 class="header-2 mb-[0.5vh]">Here’s your eName</h1>
        <p class="body-medium text-black-700!  mb-[3vh]">This identifier is permanently yours, and it stays with you for your whole life.</p>
        
        <IdentifierCard eName="AbcXyz" code="@asdasd-asdafaf-asdaffa-asfafaf"/>
    </section>
    <ButtonAction class="w-full" callback={handleNext}>Next</ButtonAction>
</main>