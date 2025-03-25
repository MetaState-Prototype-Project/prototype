<script lang="ts">
    import { goto } from "$app/navigation";
    import {ButtonAction, InputPin} from "$lib/ui";
    import Drawer from "$lib/ui/Drawer/Drawer.svelte";
    
    let pin = $state("");
    let repeatPin = $state("");
    let firstStep = $state(true);
    let showDrawer = $state(false);
    let isBiometricScreen = $state(false);

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
    }
</script>

{#if firstStep}
<main class="h-[100vh] pt-[3vh] px-[6vw] pb-[4.5vh] flex flex-col justify-between items-center">
    <section>
        <h1 class="text-3xl text-black font-semibold mb-[1vh]">Create a pin</h1>
        <p class="text-base text-black-700 font-normal mb-[14vh]">Enter a 4-digit PIN code</p>
        <InputPin bind:pin/>
    </section>
    <ButtonAction class="w-full" variant="soft" callback={handleFirstStep}>Confirm</ButtonAction>
</main>
{:else}
<main class="h-[100vh] pt-[3vh] px-[6vw] pb-[4.5vh] flex flex-col justify-between items-center">
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
    <img src="" alt="lock-icon">
    <h1 class="text-black text-xl font-medium">Pin code set!</h1>
    <p class="text-black-700 text-base font-normal mt-[0.5vh] mb-[2.3vh]">Your PIN has been created. You’ll use it to access your digital entity securely.</p>
    <ButtonAction class="w-full" callback={handleNext}>Next</ButtonAction>
    {:else}
    <img src="" alt="lock-icon">
    <h1 class="text-black text-xl font-medium">Add biometrics</h1>
    <p class="text-black-700 text-base font-normal mt-[0.5vh] mb-[2.3vh]">Use your fingerprint or face recognition for faster, more secure logins.</p>
    <div class="flex justify-center items-center gap-[11px]">
        <ButtonAction class="w-full bg-primary-100 text-primary" callback={handleSkip}>Skip</ButtonAction>
        <ButtonAction class="w-full" callback={handleSetupBiometrics}>Set up</ButtonAction>
    </div>
    {/if}
</Drawer>