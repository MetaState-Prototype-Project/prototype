<script lang="ts">
import { goto } from "$app/navigation";
import { Hero } from "$lib/fragments";
import { GlobalState } from "$lib/global";
import { ButtonAction } from "$lib/ui";
import { getContext, onMount } from "svelte";
import { capitalize } from "$lib/utils";
import Drawer from "$lib/ui/Drawer/Drawer.svelte";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import {
    PUBLIC_PROVISIONER_URL,
    PUBLIC_REGISTRY_URL,
} from "$env/static/public";
import { DocFront, verificaitonId, verifStep, status, reason } from "./store";
import Passport from "./steps/passport.svelte";
import Selfie from "./steps/selfie.svelte";
import { load } from "@tauri-apps/plugin-store";
import { Shadow } from "svelte-loading-spinners";

let globalState: GlobalState | undefined = $state(undefined);
let showVeriffModal = $state(false);
let person: Record<string, unknown>;
let document: Record<string, unknown>;
let loading = $state(false);

async function handleVerification() {
    const { data } = await axios.post(
        new URL("/verification", PUBLIC_PROVISIONER_URL).toString(),
    );
    verificaitonId.set(data.id);
    showVeriffModal = true;
    watchEventStream(data.id);
}

function watchEventStream(id: string) {
    const sseUrl = new URL(
        `/verification/sessions/${id}`,
        PUBLIC_PROVISIONER_URL,
    ).toString();
    const eventSource = new EventSource(sseUrl);

    eventSource.onopen = function (e) {
        console.log("Successfully connected.");
    };

    eventSource.onmessage = function (e) {
        const data = JSON.parse(e.data);
        if (!data.status) console.log(data);
        console.log("STATUS", data);
        status.set(data.status);
        reason.set(data.reason);
        person = data.person;
        document = data.document;
        if (data.status === "resubmission_requested") {
            DocFront.set(null);
            Selfie.set(null);
        }
        verifStep.set(2);
    };
}

let handleContinue: () => Promise<void>;

onMount(() => {
    globalState = getContext<() => GlobalState>("globalState")();
    // handle verification logic + sec user data in the store

    handleContinue = async () => {
        if ($status !== "approved") return verifStep.set(0);
        if (!globalState) throw new Error("Global state is not defined");

        loading = true;
        globalState.userController.user = {
            name: capitalize(
                person.firstName.value + " " + person.lastName.value,
            ),
            "Date of Birth": new Date(person.dateOfBirth.value).toDateString(),
            "ID submitted": "Passport - " + person.nationality.value,
            "Passport Number": document.number.value,
        };
        globalState.userController.document = {
            "Valid From": new Date(document.validFrom.value).toDateString(),
            "Valid Until": new Date(document.validUntil.value).toDateString(),
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
                verificationId: $verificaitonId,
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
    class="pt-[3svh] px-[5vw] pb-[4.5svh] flex flex-col justify-between items-center"
>
    <section>
        <Hero
            title="Verify your account"
            subtitle="Get your passport ready. You’ll be directed to present
            your passport and take a quick selfie."
        />
        <img class="mx-auto mt-20" src="images/Passport.svg" alt="passport" />
    </section>
    <ButtonAction class="w-full mt-10" callback={handleVerification}
        >I'm ready</ButtonAction
    >
    <Drawer bind:isPaneOpen={showVeriffModal}>
        {#if $verifStep === 0}
            <Passport></Passport>
        {:else if $verifStep === 1}
            <Selfie></Selfie>
        {:else if loading}
            <div class="my-20">
                <div
                    class="align-center flex w-full flex-col items-center justify-center gap-6"
                >
                    <Shadow size={40} color="rgb(142, 82, 255);" />
                    <h3>Generating your eName</h3>
                </div>
            </div>
        {:else}
            <div class="flex flex-col gap-6">
                {#if $status === "approved"}
                    <div>
                        <h3>Your verification was a success</h3>
                        <p>You can now continue on to create your eName</p>
                    </div>
                {:else if $status === "resubmission_requested"}
                    <h3>Your verification failed due to the reason</h3>
                    <p>{$reason}</p>
                {:else}
                    <h3>Your verification failed</h3>

                    <p>{$reason}</p>
                {/if}
            </div>
            <div class="flex w-full flex-col pt-4">
                {#if $status !== "declined"}
                    <ButtonAction
                        class="w-[100%]"
                        callback={handleContinue}
                        color="primary"
                        >{$status === "approved"
                            ? "Continue"
                            : "Retry"}</ButtonAction
                    >
                {/if}
            </div>
        {/if}
    </Drawer>
</main>
