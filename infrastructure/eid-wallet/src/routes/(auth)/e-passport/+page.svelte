<script lang="ts">
import { goto } from "$app/navigation";
import { Hero } from "$lib/fragments";
import IdentityCard from "$lib/fragments/IdentityCard/IdentityCard.svelte";
import { ButtonAction } from "$lib/ui";

const handleFinish = async () => {
	await goto("/main");
};
</script>


<main class="h-[max-content] pt-[5.2vh] px-[5vw] pb-[4.5vh] flex flex-col justify-between">
    <section>
        <Hero
        title="Your ePassport and eVault are ready"
        subtitle="Log into any W3DS platform without passwords. It’s tied to this phone; if lost, you’ll need to revoke and reissue it on a new device."
        class="mb-2"
        />
        <IdentityCard variant= "ePassport"
		userData= {{
			Name: "Ananya",
			Dob: "29 Nov 2003",
			Nationality: "Indian",
			Passport: "234dfvgsdfg",
		}}/>
    </section>
    <section class="mt-[4vh] mb-[9vh]">
        <h4>Your eVault</h4>
        <p class="text-black-700 mb-[1vh]">We’ve also created your eVault—secure cloud storage for your personal data. W3DS platforms access it directly, keeping you in control.</p>
        <IdentityCard variant= "eVault"
		usedStorage= {15}
		totalStorage= {80}/>
    </section>
    <ButtonAction class="w-full" callback={handleFinish}>Finish</ButtonAction>
</main>