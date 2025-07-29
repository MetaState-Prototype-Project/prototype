<script lang="ts">
import { goto } from "$app/navigation";
import {
    PUBLIC_PROVISIONER_URL,
    PUBLIC_REGISTRY_URL,
} from "$env/static/public";
import { Hero } from "$lib/fragments";
import { GlobalState } from "$lib/global";
import { ButtonAction, Drawer } from "$lib/ui";
import { capitalize } from "$lib/utils";
import {
    generate,
    getPublicKey,
    // signPayload, verifySignature
} from "@auvo/tauri-plugin-crypto-hw-api";
import * as falso from "@ngneat/falso";
import axios from "axios";
import { getContext, onMount } from "svelte";
import { Shadow } from "svelte-loading-spinners";
import { v4 as uuidv4 } from "uuid";

let isPaneOpen = $state(false);
let preVerified = $state(false);
let loading = $state(false);
let verificationId = $state("");
let demoName = $state("");
let verificationSuccess = $state(false);

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

// IMO, call this function early, check if hardware even supports the app
// docs: https://github.com/auvoid/tauri-plugin-crypto-hw/blob/48d0b9db7083f9819766e7b3bfd19e39de9a77f3/examples/tauri-app/src/App.svelte#L13
async function generateApplicationKeyPair() {
    let res: string | undefined;
    try {
        res = await generate("default");
        console.log(res);
    } catch (e) {
        // Put hardware crypto missing error here
        console.log(e);
    }
    return res;
}

async function getApplicationPublicKey() {
    let res: string | undefined;
    try {
        res = await getPublicKey("default");
        console.log(res);
    } catch (e) {
        console.log(e);
    }
    return res; // check getPublicKey doc comments (multibase hex format)
}

const handleNext = async () => {
    //handle next functionlity
    goto("/verify");
};

let globalState: GlobalState;
let handleContinue: () => Promise<void> | void;
let handleFinalSubmit: () => Promise<void> | void;
let ename: string;
let uri: string;

let error: string | null = $state(null);

onMount(() => {
    globalState = getContext<() => GlobalState>("globalState")();
    // handle verification logic + sec user data in the store

    handleContinue = async () => {
        loading = true;
        const {
            data: { token: registryEntropy },
        } = await axios.get(
            new URL("/entropy", PUBLIC_REGISTRY_URL).toString(),
        );

        const { data } = await axios
            .post(new URL("/provision", PUBLIC_PROVISIONER_URL).toString(), {
                registryEntropy,
                namespace: uuidv4(),
                verificationId,
            })
            .catch(() => {
                loading = false;
                console.log("caught");
                preVerified = false;
                verificationId = "";
                error = "Wrong pre-verificaiton code";
                setTimeout(() => {
                    error = null;
                }, 6_000);
                return { data: null };
            });
        if (!data) return;

        // If verification is successful, show demo name input
        if (data.success === true) {
            loading = false;
            verificationSuccess = true;
            uri = data.uri;
            ename = data.w3id;
        }
    };

    // New function to handle final submission with demo name
    handleFinalSubmit = async () => {
        loading = true;

        const tenYearsLater = new Date();
        tenYearsLater.setFullYear(tenYearsLater.getFullYear() + 10);
        globalState.userController.user = {
            name:
                demoName ||
                capitalize(`${falso.randFirstName()} ${falso.randLastName()}`),
            "Date of Birth": new Date().toDateString(),
            "ID submitted": `Passport - ${falso.randCountryCode()}`,
            "Passport Number": generatePassportNumber(),
        };
        globalState.userController.isFake = true;
        globalState.userController.document = {
            "Valid From": new Date(Date.now()).toDateString(),
            "Valid Until": tenYearsLater.toDateString(),
            "Verified On": new Date().toDateString(),
        };
        globalState.vaultController.vault = {
            uri,
            ename,
        };

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

<Drawer bind:isPaneOpen>
    <img src="/images/GetStarted.svg" alt="get-started" />
    {#if error}
        <div
            class="bg-[#ff3300] rounded-md mt-4 p-2 w-full text-center text-white"
        >
            {error}
        </div>
    {/if}
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
        {#if verificationSuccess}
            <h4 class="mt-[2.3svh] mb-[0.5svh]">Verification Successful!</h4>
            <p class="text-black-700">Enter Demo Name for your ePassport</p>
            <input
                type="text"
                bind:value={demoName}
                class="border-1 border-gray-200 w-full rounded-md font-medium my-2 p-2"
                placeholder="Enter your demo name for ePassport"
            />
            <div class="flex justify-center whitespace-nowrap my-[2.3svh]">
                <ButtonAction class="w-full" callback={handleFinalSubmit}
                    >Continue</ButtonAction
                >
            </div>
        {:else}
            <h4 class="mt-[2.3svh] mb-[0.5svh]">
                Welcome to Web 3.0 Data Spaces
            </h4>
            <p class="text-black-700">Enter Verification Code</p>
            <input
                type="text"
                bind:value={verificationId}
                class="border-1 border-gray-200 w-full rounded-md font-medium my-2 p-2"
                placeholder="Enter verification code"
            />
            <div class="flex justify-center whitespace-nowrap my-[2.3svh]">
                <ButtonAction class="w-full" callback={handleContinue}
                    >Next</ButtonAction
                >
            </div>
        {/if}
    {:else}
        <h4 class="mt-[2.3svh] mb-[0.5svh]">
            Your Digital Self begins with the Real You
        </h4>
        <p class="text-black-700">
            In the Web 3.0 Data Space, identity is linked to reality. We begin
            by verifying your real-world passport, which serves as the
            foundation for issuing your secure ePassport. At the same time, we
            generate your eName – a unique digital identifier – and create your
            eVault to store and protect your personal data.
        </p>
        <div class="flex justify-center whitespace-nowrap my-[2.3svh]">
            <ButtonAction class="w-full" callback={handleNext}
                >Next</ButtonAction
            >
        </div>
    {/if}
</Drawer>
