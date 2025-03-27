<script lang="ts">
import { goto } from "$app/navigation";
import { ButtonAction, Drawer, InputPin } from "$lib/ui";
import { CircleLock01Icon, FaceIdIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";

let pin = $state("");
let repeatPin = $state("");
let firstStep = $state(true);
let showDrawer = $state(false);
let isBiometricScreen = $state(false);
let isBiometricsAdded = $state(false);
let isError = $state(false);

const handleFirstStep = async () => {
	if (pin.length === 4) firstStep = false;
};

const handleConfirm = async () => {
	//confirm pin logic goes here
	if (repeatPin && repeatPin.length === 4 && pin !== repeatPin) isError = true;
	else isError = false;

	if (!isError) showDrawer = true;
};

const handleNext = async () => {
	//handle next logic goes here
	isBiometricScreen = true;
};

const handleSkip = async () => {
	// handle skip biometics logic goes here
};

const handleSetupBiometrics = async () => {
	//handle setup biometrics logic goes here
	isBiometricsAdded = true;
};

const handleEnableBiometrics = async () => {
	//handle enable biometrics logic goes here
};

const handleBiometricsAdded = async () => {
	//handle logic when biometrics added successfully
	goto("/review");
};

$effect(() => {
	if (repeatPin && repeatPin.length === 4 && pin === repeatPin) isError = false;
});
</script>

{#if firstStep}
<main class="h-[100vh] pt-[5.2vh] px-[5vw] pb-[4.5vh] flex flex-col justify-between">
    <section>
        <h3 class="mb-[1vh]">Create a pin</h3>
        <p class="text-black-700 mb-[14vh]">Enter a 4-digit PIN code</p>
        <InputPin bind:pin/>
    </section>
    <ButtonAction class="w-full" variant="soft" callback={handleFirstStep}>Confirm</ButtonAction>
</main>
{:else}
<main class="h-[100vh] pt-[5.2vh] px-[5vw] pb-[4.5vh] flex flex-col justify-between">
    <section>
        <h3 class="mb-[1vh]">Re-enter your pin</h3>
        <p class="text-black-700 mb-[14vh]">Confirm by entering pin again</p>
        <InputPin bind:pin={repeatPin} {isError}/>
        <p class={`text-danger mt-[3.4vh] ${isError ? "block" : "hidden"}`}>Your PIN does not match, try again.</p>
    </section>
    <ButtonAction class="w-full" callback={handleConfirm}>Confirm</ButtonAction>
</main>
{/if}


<Drawer bind:isPaneOpen={showDrawer} isCancelRequired={true}>
    {#if !isBiometricScreen}
    <div class="relative bg-gray w-[72px] h-[72px] rounded-[24px] flex justify-center items-center mb-[2.3vh]">
        <span class="relative z-[1]">
            <HugeiconsIcon icon={CircleLock01Icon} color="var(--color-primary)"/>
        </span>
        <img class="absolute top-0 start-0" src="/images/Line.svg" alt="line">
        <img class="absolute top-0 start-0" src="/images/Line2.svg" alt="line">
    </div>
    <h4>Pin code set!</h4>
    <p class="text-black-700! mt-[0.5vh] mb-[2.3vh]">Your PIN has been created. You’ll use it to access your digital entity securely.</p>
    <ButtonAction class="w-full" callback={handleNext}>Next</ButtonAction>
    {:else}
    <div class="relative bg-gray w-[72px] h-[72px] rounded-[24px] flex justify-center items-center mb-[2.3vh]">
        <span class="relative z-[1]">
            <HugeiconsIcon icon={FaceIdIcon} color="var(--color-primary)" />
        </span>
        <img class="absolute top-0 start-0" src="/images/Line.svg" alt="line">
        <img class="absolute top-0 start-0" src="/images/Line2.svg" alt="line">
    </div>
    <h4>{isBiometricsAdded ? "You’re all set!" : "Add biometrics"}</h4>
    <p class="text-black-700! mt-[0.5vh] mb-[2.3vh]">{ isBiometricsAdded ? "Your biometrics have been successfully added." : "Use your fingerprint or face recognition for faster, more secure logins."}</p>
    {#if !isBiometricsAdded}
    <div class="flex justify-center items-center gap-[11px]">
        <ButtonAction class="w-full bg-primary-100 text-primary" callback={handleSkip}>Skip</ButtonAction>
        <ButtonAction class="w-full" callback={handleSetupBiometrics}>Set up</ButtonAction>
    </div>
    {:else}
    <ButtonAction class="w-full" callback={handleBiometricsAdded}>Continue</ButtonAction>
    {/if}
    {/if}
</Drawer>