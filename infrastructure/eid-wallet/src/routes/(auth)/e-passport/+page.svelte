<script lang="ts">
import { Hero } from "$lib/fragments";
import IdentityCard from "$lib/fragments/IdentityCard/IdentityCard.svelte";
import { ButtonAction } from "$lib/ui";

const handleFinish = async () => {};
</script>


<main class="h-[max-content] pt-[5.2vh] px-[5vw] pb-[4.5vh] flex flex-col justify-between">
    <section>
        <h3 class="mb-[0.5vh]">Your ePassport and eVault are ready</h3>
        <p class="text-black-700 mb-[3vh]">Log into any W3DS platform without passwords. It’s tied to this phone; if lost, you’ll need to revoke and reissue it on a new device.</p>
        <IdentityCard variant= "ePassport"
		viewBtn= {() => alert("View")}
		userData= {{
			Name: "Ananya",
			Dob: "29 Nov 2003",
			Nationality: "Indian",
			Passport: "234dfvgsdfg",
		}}/>
    </section>
    <section class="mt-[4vh] mb-[9vh]">
        <Hero
        title="Your ePassport and eVault are ready"
        subtitle="Log into any W3DS platform without passwords. It’s tied to this phone; if lost, you’ll need to revoke and reissue it on a new device."
        class="mb-2"
        />
        <IdentityCard variant= "eVault"
		usedStorage= {15}
		totalStorage= {80}/>
    </section>
    <ButtonAction class="w-full" callback={handleFinish}>Finish</ButtonAction>
</main>