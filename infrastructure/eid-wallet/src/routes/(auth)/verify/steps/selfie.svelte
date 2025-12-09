<script lang="ts">
import { PUBLIC_PROVISIONER_URL, PUBLIC_REGISTRY_URL } from "$env/static/public";
import { ButtonAction } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { goto } from "$app/navigation";
import axios from "axios";
import { getContext, onMount } from "svelte";
import { Shadow } from "svelte-loading-spinners";
import { writable } from "svelte/store";
import { Selfie, permissionGranted, verifStep, verificaitonId, status, reason, verificationPerson, verificationDocument, verificationWebsocketData } from "../store";
import type { GlobalState } from "$lib/global";
import { capitalize } from "$lib/utils";
import { v4 as uuidv4 } from "uuid";

let video: HTMLVideoElement;
let canvas: HTMLCanvasElement;
let image = 1;
let imageCaptured = writable(false);
let load = false;
let stream: MediaStream;
let showResults = $state(false);
let loading = $state(false);
let globalState: GlobalState | undefined = $state(undefined);

async function requestCameraPermission() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
        });
        video.srcObject = stream;
        video.play();
        permissionGranted.set(true);
    } catch (err) {
        permissionGranted.set(false);
        console.error("Camera permission denied", err);
    }
}

function stopCamera() {
    if (stream) {
        for (const track of stream.getTracks()) {
            track.stop();
        }
    }
}

// Watch for status changes from SSE
$effect(() => {
    if ($status && $verifStep === 3) {
        showResults = true;
    }
});

onMount(() => {
    globalState = getContext<() => GlobalState>("globalState")();
    requestCameraPermission();
    
    return () => {
        stopCamera();
    };
});

async function captureImage() {
    if (image === 1) {
        const context = canvas.getContext("2d");
        if (context) {
            context.drawImage(video, 0, 0, 1920, 1080);
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/png");
            Selfie.set(dataUrl);
            load = true;
            await axios.post(
                new URL(
                    `/verification/${$verificaitonId}/media`,
                    PUBLIC_PROVISIONER_URL,
                ).toString(),
                {
                    img: dataUrl,
                    type: "face",
                },
            );
            await axios.patch(
                new URL(
                    `/verification/${$verificaitonId}`,
                    PUBLIC_PROVISIONER_URL,
                ).toString(),
            );
            stopCamera();
            // Stay on this page and show spinner
            // The verification step will be updated by the SSE response
            // When status is set, showResults will be true
        }
    }
}

async function getApplicationPublicKey(): Promise<string> {
    if (!globalState) throw new Error("Global state is not defined");
    const keyManager = globalState.keyService.getKeyManagerForContext("verification");
    const publicKey = await keyManager.getPublicKey("default");
    return publicKey;
}

async function handleContinue() {
    if ($status !== "approved" && $status !== "duplicate") {
        return verifStep.set(0);
    }
    if (!globalState) throw new Error("Global state is not defined");
    if (!$verificationPerson || !$verificationDocument) {
        console.error("Missing verification data");
        return;
    }

    loading = true;
    
    try {
        globalState.userController.user = {
            name: capitalize(
                `${$verificationPerson.firstName.value} ${$verificationPerson.lastName.value ?? ""}`,
            ),
            "Date of Birth": new Date($verificationPerson.dateOfBirth.value).toDateString(),
            "ID submitted":
                $verificationDocument.type.value === "passport"
                    ? `Passport - ${$verificationDocument.country.value}`
                    : $verificationDocument.type.value === "drivers_license"
                      ? `Driving License - ${$verificationDocument.country.value}`
                      : `ID Card - ${$verificationDocument.country.value}`,
            "Document Number": $verificationDocument.number.value,
        };
        globalState.userController.document = {
            "Valid From": new Date($verificationDocument.validFrom.value).toDateString(),
            "Valid Until": new Date($verificationDocument.validUntil.value).toDateString(),
            "Verified On": new Date().toDateString(),
        };
        globalState.userController.isFake = false;

        if ($status === "duplicate") {
            // For duplicate case, skip provision and resolve the existing eVault URI
            const existingW3id = $verificationWebsocketData?.w3id;
            if (!existingW3id) {
                throw new Error("No w3id provided for duplicate eVault");
            }

            // Resolve the eVault URI from the registry
            const response = await axios.get(
                new URL(
                    `resolve?w3id=${existingW3id}`,
                    PUBLIC_REGISTRY_URL,
                ).toString(),
            );
            // Skip profile creation for duplicates by setting status directly
            globalState.vaultController.profileCreationStatus = "success";
            // For duplicates, just set the vault without triggering profile creation
            globalState.vaultController.vault = {
                uri: response.data.uri,
                ename: existingW3id,
            };
        } else {
            // Normal flow for approved status
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
                    publicKey: await getApplicationPublicKey(),
                },
            );
            if (data.success === true) {
                // Set vault in controller - this will trigger profile creation with retry logic
                globalState.vaultController.vault = {
                    uri: data.uri,
                    ename: data.w3id,
                };
            }
        }

        // Go straight to register WITHOUT the 10-second delay
        goto("/register");
    } catch (error) {
        console.error("Failed to provision:", error);
        loading = false;
    }
}
</script>

<div class="flex flex-col gap-5">
    {#if !load && !showResults}
        <div class="flex flex-col gap-2 mb-2">
            <button
                onclick={() => {
                    if (stream) {
                        for (const track of stream.getTracks()) {
                            track.stop();
                        }
                    }
                    goto("/verify/passport");
                }}
                class="cursor-pointer self-start flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
            >
                <Button.Icon
                    icon={ArrowLeft01Icon}
                    iconColor="currentColor"
                    strokeWidth={2}
                    class="w-4 h-4"
                />
                <span>go back</span>
            </button>
        <div>
            <h3>Take a Selfie</h3>
            <p>
                Place your face in the center of the circle and press the take
                photo button
            </p>
            </div>
        </div>

        <div class="flex flex-col gap-1">
            <div
                class="relative mt-3 flex flex-col items-center justify-center"
            >
                <!-- svelte-ignore a11y-media-has-caption -->
                <video
                    bind:this={video}
                    autoplay
                    playsinline
                    class=" aspect-[4/3] w-full rounded-lg object-cover"
                ></video>
                <img
                    src="/images/CameraCircle.svg"
                    class="absolute h-[90%]"
                    alt=""
                />
            </div>
            <br />
            <div class="md:flex md:gap-4">
                <div class="">
                    <canvas bind:this={canvas} class="hidden"></canvas>
                </div>
            </div>
        </div>
        <div class="text-center text-xs text-black-700">
            Please make sure that your face is in the frame and clearly visible.
        </div>

        <ButtonAction class="w-full" callback={captureImage}
            >{"Take Photo"}</ButtonAction
        >
    {:else if load && !showResults}
        <div class="fixed inset-0 flex items-center justify-center bg-white z-50">
            <div
                class="flex flex-col items-center justify-center gap-6"
            >
                <Shadow size={40} color="rgb(142, 82, 255);" />
                <h3>Verifying your identity</h3>
            </div>
        </div>
    {:else if showResults}
        <div class="flex flex-col gap-6 pt-4">
            {#if loading}
                <div class="flex flex-col items-center justify-center gap-6 py-20">
                    <Shadow size={40} color="rgb(142, 82, 255);" />
                    <h3>Setting up your account</h3>
                </div>
            {:else}
                {#if $status === "approved"}
                    <div>
                        <h3>Your verification was a success</h3>
                        <p>You can now continue to create your eName</p>
                    </div>
                {:else if $status === "duplicate"}
                    <div>
                        <h3>Old eVault Found</h3>
                        <p>
                            We found an existing eVault associated with your
                            identity. You can claim it back to continue
                            using your account.
                        </p>
                    </div>
                {:else if $status === "resubmission_requested"}
                    <div>
                        <h3>Your verification failed</h3>
                        <p>{$reason}</p>
                    </div>
                {:else}
                    <div>
                        <h3>Your verification failed</h3>
                        <p>{$reason}</p>
                    </div>
                {/if}
                
                <div class="flex w-full flex-col pt-4">
                    {#if $status !== "declined"}
                        <ButtonAction
                            class="w-full"
                            callback={handleContinue}
                            color="primary"
                            disabled={loading}
                        >
                            {$status === "approved"
                                ? "Continue"
                                : $status === "duplicate"
                                  ? "Claim old eVault"
                                  : "Retry"}
                        </ButtonAction>
                    {/if}
                </div>
            {/if}
        </div>
    {/if}
</div>
