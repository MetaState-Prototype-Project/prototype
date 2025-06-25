<script lang="ts">
    import { goto } from "$app/navigation";
    import { Hero } from "$lib/fragments";
    import { ButtonAction, Drawer } from "$lib/ui";
    import { getContext, onMount } from "svelte";
    import { GlobalState } from "$lib/global";
    import axios from "axios";
    import { v4 as uuidv4 } from "uuid";
    import {
        PUBLIC_PROVISIONER_URL,
        PUBLIC_REGISTRY_URL,
    } from "$env/static/public";
    import { capitalize } from "$lib/utils";
    import * as falso from "@ngneat/falso";
    import { Shadow } from "svelte-loading-spinners";

    let isPaneOpen = $state(false);
    let preVerified = $state(false);
    let loading = $state(false);
    let verificationId = $state("");

    const handleGetStarted = async () => {
        //get started functionality
        isPaneOpen = true;
        preVerified = false;
    };

    const handlePreVerified = () => {
        isPaneOpen = true;
        preVerified = true;
    };

    function generatePassportNumber() {
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const randomLetters = () =>
            letters.charAt(Math.floor(Math.random() * letters.length)) +
            letters.charAt(Math.floor(Math.random() * letters.length));
        const randomDigits = () =>
            String(Math.floor(1000000 + Math.random() * 9000000)); // 7 digits

        return randomLetters() + randomDigits();
    }

    const handleNext = async () => {
        //handle next functionlity
        goto("/verify");
    };

    let globalState: GlobalState;
    let handleContinue: () => Promise<void> | void;

    onMount(() => {
        globalState = getContext<() => GlobalState>("globalState")();
        // handle verification logic + sec user data in the store

        handleContinue = async () => {
            loading = true;
            const tenYearsLater = new Date();
            tenYearsLater.setFullYear(tenYearsLater.getFullYear() + 10);
            globalState.userController.user = {
                name: capitalize(
                    `${falso.randFirstName()} ${falso.randLastName()}`,
                ),
                "Date of Birth": new Date().toDateString(),
                "ID submitted": "Passport - " + falso.randCountryCode(),
                "Passport Number": generatePassportNumber(),
            };
            globalState.userController.document = {
                "Valid From": new Date(Date.now()).toDateString(),
                "Valid Until": tenYearsLater.toDateString(),
                "Verified On": new Date().toDateString(),
            };
            const {
                data: { token: registryEntropy },
            } = await axios.get(
                new URL("/entropy", PUBLIC_REGISTRY_URL).toString(),
            );
            const { data } = await axios.post(
                new URL("/provision", PUBLIC_PROVISIONER_URL).toString(),
                {
                    registryEntropy,
                    namespace: uuidv4(),
                    verificationId,
                },
            );
            if (data.success === true) {
                globalState.vaultController.vault = {
                    uri: data.uri,
                    ename: data.w3id,
                };
            }
            setTimeout(() => {
                goto("/register");
            }, 10_000);
        };
    });
</script>

<main
    class="h-full pt-[4svh] px-[5vw] pb-[4.5svh] flex flex-col justify-between"
>
    <article class="flex justify-center mb-4">
        <img
            class="w-[88vw] h-[39svh]"
            src="/images/Onboarding.svg"
            alt="Infographic card"
        />
    </article>
    <section>
        <Hero class="mb-4" titleClasses="text-[42px]/[1.1] font-medium">
            {#snippet subtitle()}
                Your Digital Self consists of three core elements: <br />
                <strong>– eName</strong> – your digital identifier, a number
                <br />
                <strong>– ePassport</strong> – your cryptographic keys, enabling
                your agency and control
                <br />
                <strong>– eVault</strong> – the secure repository of all your
                personal data. You will decide who can access it, and how. You
                are going to get them now.
                <br />
            {/snippet}
            Your Digital Self<br />
            <h4>in Web 3.0 Data Space</h4>
        </Hero>
    </section>
    <section>
        <p class="text-center small text-black-500">
            By continuing you agree to our <br />
            <a href="/" class="text-primary underline underline-offset-4"
                >Terms & Conditions
            </a>
            and
            <a href="/" class="text-primary underline underline-offset-4"
                >Privacy Policy.</a
            >
        </p>
        <div class="flex justify-center whitespace-nowrap mt-1">
            <ButtonAction class="w-full" callback={handleGetStarted}
                >Get Started</ButtonAction
            >
        </div>

        <p class="mt-2 text-center">
            Already have a pre-verification code? <button
                onclick={handlePreVerified}
                class="text-primary-500">Click Here</button
            >
        </p>
    </section>
</main>

<Drawer bind:preVerified>
    <h4 class="mt-[2.3svh] mb-[0.5svh]">Welcome to Web 3.0 Data Spaces</h4>
    <p class="text-black-700">
        Your <strong>eName</strong> is more than a name—it's your unique digital
        passport. One constant identifier that travels with you across the internet,
        connecting your real-world self to the digital universe.
    </p>
</Drawer>

<Drawer bind:isPaneOpen>
    <img src="/images/GetStarted.svg" alt="get-started" />
    {#if loading}
        <div class="my-20">
            <div
                class="align-center flex w-full flex-col items-center justify-center gap-6"
            >
                <Shadow size={40} color="rgb(142, 82, 255);" />
                <h4>Generating your eName</h4>
            </div>
        </div>
    {:else if preVerified}
        <h4 class="mt-[2.3svh] mb-[0.5svh]">Welcome to Web 3.0 Data Spaces</h4>
        <p class="text-black-700">Enter Verification Code</p>
        <input
            type="text"
            bind:value={verificationId}
            class="border-1 border-gray-200 w-full rounded-md font-medium my-2 p-2"
        />
        <div class="flex justify-center whitespace-nowrap my-[2.3svh]">
            <ButtonAction class="w-full" callback={handleContinue}
                >Next</ButtonAction
            >
        </div>
    {:else}
        <h4 class="mt-[2.3svh] mb-[0.5svh]">Welcome to Web 3.0 Data Spaces</h4>
        <p class="text-black-700">
            Your <strong>eName</strong> is more than a name—it's your unique digital
            passport. One constant identifier that travels with you across the internet,
            connecting your real-world self to the digital universe.
        </p>
        <div class="flex justify-center whitespace-nowrap my-[2.3svh]">
            <ButtonAction class="w-full" callback={handleNext}
                >Next</ButtonAction
            >
        </div>
    {/if}
</Drawer>
