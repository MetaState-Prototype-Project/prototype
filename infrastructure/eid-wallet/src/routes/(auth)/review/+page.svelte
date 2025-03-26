<script lang="ts">
    import { IdentifierCard } from "$lib/fragments";
    import { ButtonAction } from "$lib/ui";

    const handleNext = async() => {

    }
</script>

<main class="h-[100vh] pt-[5.2vh] px-[2.3vw] pb-[4.5vh] flex flex-col justify-between">
    <section>
        <h1 class="text-3xl text-black font-semibold mb-[0.5vh]">Here’s your eName</h1>
        <p class="text-base text-black-700 font-normal mb-[3vh]">This identifier is permanently yours, and it stays with you for your whole life.</p>
        
        <IdentifierCard eName="AbcXyz" code="@asdasd-asdafaf-asdaffa-asfafaf"/>
    </section>
    <ButtonAction class="w-full" callback={handleNext}>Next</ButtonAction>
</main>