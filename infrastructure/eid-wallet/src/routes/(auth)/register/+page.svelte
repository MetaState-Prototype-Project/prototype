<script lang="ts">
    import {ButtonAction, InputPin,Drawer} from "$lib/ui";
    import { CircleLock01Icon, FaceIdIcon } from "@hugeicons/core-free-icons";
    import { HugeiconsIcon } from "@hugeicons/svelte";
    
    let pin = $state("");
    let repeatPin = $state("");
    let firstStep = $state(true);
    let showDrawer = $state(false);
    let isBiometricScreen = $state(false);
    let isModalOpen = $state(false);

    const handleFirstStep = async() => {
        if(pin.length === 4) firstStep = false;
    }

    const handleConfirm = async() => {
        //confirm pin logic goes here
        if(pin.length === 4 && repeatPin.length ===4 && pin === repeatPin) showDrawer = true;
    }

    const handleNext = async() => {
        //handle next logic goes here
        isBiometricScreen = true;
    }

    const handleSkip = async() => {
        // handle skip biometics logic goes here
    }

    const handleSetupBiometrics = async() => {
        //handle setup biometrics logic goes here
        isModalOpen = true
    }

    const handleEnableBiometrics = async() => {
        //handle enable biometrics logic goes here
    }
</script>

{#if firstStep}
<main class="h-[100vh] pt-[5.2vh] px-[2.3vw] pb-[4.5vh] flex flex-col justify-between">
    <section>
        <h1 class="text-3xl text-black font-semibold mb-[1vh]">Create a pin</h1>
        <p class="text-base text-black-700 font-normal mb-[14vh]">Enter a 4-digit PIN code</p>
        <InputPin bind:pin/>
    </section>
    <ButtonAction class="w-full" variant="soft" callback={handleFirstStep}>Confirm</ButtonAction>
</main>
{:else}
<main class="h-[100vh] pt-[5.2vh] px-[2.3vw] pb-[4.5vh] flex flex-col justify-between">
    <section>
        <h1 class="text-3xl text-black font-semibold mb-[1vh]">Re-enter your pin</h1>
        <p class="text-base text-black-700 font-normal mb-[14vh]">Confirm by entering pin again</p>
        <InputPin bind:pin={repeatPin}/>
    </section>
    <ButtonAction class="w-full" callback={handleConfirm}>Confirm</ButtonAction>
</main>
{/if}


<Drawer bind:isPaneOpen={showDrawer} isCancelRequired={true}>
    {#if !isBiometricScreen}
    <div class="relative bg-gray-900 w-[72px] h-[72px] rounded-[24px] flex justify-center items-center mb-[2.3vh]">
        <span class="relative z-[1]">
            <HugeiconsIcon icon={CircleLock01Icon} color="var(--color-primary)"/>
        </span>
        <img class="absolute top-0 start-0" src="/images/Line.svg" alt="line">
        <img class="absolute top-0 start-0" src="/images/Line2.svg" alt="line">
    </div>
    <h1 class="text-black text-xl font-medium">Pin code set!</h1>
    <p class="text-black-700 text-base font-normal mt-[0.5vh] mb-[2.3vh]">Your PIN has been created. You’ll use it to access your digital entity securely.</p>
    <ButtonAction class="w-full" callback={handleNext}>Next</ButtonAction>
    {:else}
    <div class="relative bg-gray-900 w-[72px] h-[72px] rounded-[24px] flex justify-center items-center mb-[2.3vh]">
        <span class="relative z-[1]">
            <HugeiconsIcon icon={FaceIdIcon} color="var(--color-primary)" />
        </span>
        <img class="absolute top-0 start-0" src="/images/Line.svg" alt="line">
        <img class="absolute top-0 start-0" src="/images/Line2.svg" alt="line">
    </div>
    <h1 class="text-black text-xl font-medium">Add biometrics</h1>
    <p class="text-black-700 text-base font-normal mt-[0.5vh] mb-[2.3vh]">Use your fingerprint or face recognition for faster, more secure logins.</p>
    <div class="flex justify-center items-center gap-[11px]">
        <ButtonAction class="w-full bg-primary-100 text-primary" callback={handleSkip}>Skip</ButtonAction>
        <ButtonAction class="w-full" callback={handleSetupBiometrics}>Set up</ButtonAction>
    </div>
    {/if}
</Drawer>