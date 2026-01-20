<script lang="ts">
import { PUBLIC_PROVISIONER_URL } from "$env/static/public";
import { ButtonAction, CameraPermissionDialog } from "$lib/ui";
import { createCameraPermissionManager } from "$lib/utils";
import axios from "axios";
import { onMount } from "svelte";
import { get, writable } from "svelte/store";
import {
    DocBack,
    DocFront,
    documentType,
    permissionGranted,
    verifStep,
    verificaitonId,
} from "../store";

let error: string | undefined;

let video: HTMLVideoElement;
let canvas1: HTMLCanvasElement;
let canvas2: HTMLCanvasElement;
let image = 1;
let image1Captured = writable(false);
let image2Captured = writable(false);
let loading = false;
let stream: MediaStream;

// Camera permission management
const cameraPermission = createCameraPermissionManager();
const { permissionState, checkAndRequestPermission, openSettings } =
    cameraPermission;
let showPermissionDialog = $state(false);

async function hasTorch(track: MediaStreamTrack) {
    try {
        const capabilities = track.getCapabilities?.();
        return capabilities && "torch" in capabilities;
    } catch {
        return false;
    }
}

async function findMainCameraWithTorch() {
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
        (d) => d.kind === "videoinput",
    );

    for (const device of devices) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: device.deviceId } },
            });

            const track = stream.getVideoTracks()[0];
            const supportsTorch = await hasTorch(track);
            track.stop();

            if (supportsTorch) {
                return device.deviceId;
            }
        } catch (err) {
            console.warn(`Could not test device ${device.deviceId}`, err);
        }
    }

    // Fallback to first device if no torch found
    return devices[0]?.deviceId;
}

async function getMainCameraStream() {
    try {
        const availableDevices = (
            await navigator.mediaDevices.enumerateDevices()
        )
            .filter((d) => d.kind === "videoinput")
            .map((d) => d.deviceId);

        const mainCamId = await findMainCameraWithTorch();
        return await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: mainCamId } },
        });
    } catch (err) {
        console.error("Failed to get main camera stream:", err);
        throw err;
    }
}

async function requestCameraPermission() {
    // First check native permissions via Tauri
    let hasPermission: boolean;
    try {
        hasPermission = await checkAndRequestPermission();
    } catch (err) {
        console.error("Error checking camera permission:", err);
        permissionGranted.set(false);
        showPermissionDialog = true;
        return;
    }

    if (!hasPermission) {
        permissionGranted.set(false);
        showPermissionDialog = true;
        return;
    }

    // Now get the camera stream
    try {
        stream = await getMainCameraStream();
        video.srcObject = stream;
        video.play();
        permissionGranted.set(true);
        showPermissionDialog = false;
    } catch (err) {
        permissionGranted.set(false);
        showPermissionDialog = true;
        console.error("Camera permission denied", err);
    }
}

async function handleOpenSettings() {
    await openSettings();
    // Re-check camera permission after returning from settings
    await requestCameraPermission();
}
async function captureImage() {
    if (image === 1) {
        const context1 = canvas1.getContext("2d");
        if (context1) {
            context1.drawImage(video, 0, 0, 1920, 1080);
            canvas1.width = video.videoWidth;
            canvas1.height = video.videoHeight;
            context1.drawImage(video, 0, 0, canvas1.width, canvas1.height);
            const dataUrl = canvas1.toDataURL("image/png");
            DocFront.set(dataUrl);
            loading = true;
            try {
                await axios.post(
                    new URL(
                        `/verification/${$verificaitonId}/media`,
                        PUBLIC_PROVISIONER_URL,
                    ).toString(),
                    {
                        img: dataUrl,
                        type: "document-front",
                    },
                );
            } catch (err) {
                console.error("Failed to upload front image:", err);
                error = "Failed to upload image. Please try again.";
                loading = false;
                return;
            }
            loading = false;
            image1Captured.set(true);

            // Don't stop camera - keep it running for retake or back photo
            if ($documentType !== "passport") {
                image = 2; // Go to back image capture for non-passport documents
                console.log("Switched to back image capture, image =", image);
            }
        }
    } else if (image === 2) {
        const context2 = canvas2.getContext("2d");
        if (context2) {
            context2.drawImage(video, 0, 0, 1920, 1080);
            canvas2.width = video.videoWidth;
            canvas2.height = video.videoHeight;
            context2.drawImage(video, 0, 0, canvas2.width, canvas2.height);
            const dataUrl = canvas2.toDataURL("image/png");
            DocBack.set(dataUrl);
            loading = true;
            try {
                await axios.post(
                    new URL(
                        `/verification/${$verificaitonId}/media`,
                        PUBLIC_PROVISIONER_URL,
                    ).toString(),
                    {
                        img: dataUrl,
                        type: "document-back",
                    },
                );
            } catch (err) {
                console.error("Failed to upload back image:", err);
                error = "Failed to upload image. Please try again.";
                loading = false;
                return;
            }
            loading = false;
            image2Captured.set(true);
            console.log("Back image captured");
            // Don't stop camera - keep it running for retake option
            // Camera will be stopped when navigating away or on component cleanup
        }
    }
}

function retakeImages() {
    image1Captured.set(false);
    image2Captured.set(false);
    image = 1;
    const context1 = canvas1?.getContext("2d");
    if (context1) {
        context1.clearRect(0, 0, canvas1.width, canvas1.height);
    }
    const context2 = canvas2?.getContext("2d");
    if (context2) {
        context2.clearRect(0, 0, canvas2.width, canvas2.height);
    }
    DocFront.set(null);
    DocBack.set(null);
    // Camera is still running, ready to capture again
}

function stopCamera() {
    if (stream) {
        for (const track of stream.getTracks()) {
            track.stop();
        }
    }
}

function continueToSelfie() {
    stopCamera();
    verifStep.set(2);
}

onMount(() => {
    requestCameraPermission();

    // Cleanup camera when component unmounts
    return () => {
        stopCamera();
    };
});
</script>

<div>
    {#if error}
        <div
            class="bg-red-500/20 border border-red-500 rounded-lg p-3 mb-4 text-red-200 text-sm"
        >
            {error}
        </div>
    {/if}
    <div class="flex flex-col h-[90vh]">
        <div class="flex flex-col items-center gap-1">
            <div class="mb-10">
                <h3>
                    {#if $documentType === "passport"}
                        Present your Passport
                    {:else if $documentType === "id"}
                        Present your ID Card
                    {:else if $documentType === "dl"}
                        Present your Driving License
                    {:else if $documentType === "permit"}
                        Present your Residence Permit
                    {/if}
                </h3>
                <p>
                    Please place your document's {$DocFront ? "back" : "photo"} page
                    within the rectangle and press the take photo button
                </p>
            </div>
            <div class="relative flex flex-col items-center justify-center">
                <!-- svelte-ignore a11y-media-has-caption -->
                <video
                    bind:this={video}
                    autoplay
                    playsinline
                    class=" aspect-[4/3] w-full rounded-lg object-cover"
                ></video>
                <img
                    src="/images/CameraFrame.svg"
                    class="absolute left-[50%] top-[50%] w-[90%] translate-x-[-50%] translate-y-[-50%]"
                    alt=""
                />
            </div>
            <br />
            <canvas bind:this={canvas1} class="hidden"></canvas>
            <canvas bind:this={canvas2} class="hidden"></canvas>

            <div class="text-center text-xs text-gray-400 mb-4 px-4">
                <!-- Accepted documents: Driver's License, Residence Permit, Passport, ID Card. -->
                {#if $documentType === "passport"}
                    Present your Passport's photo page
                {:else if $documentType === "id"}
                    Present your ID Card's
                    {#if !$DocFront}
                        front page
                    {:else}
                        back page
                    {/if}
                {:else if $documentType === "dl"}
                    Present your Driving License's
                    {#if !$DocFront}
                        front page
                    {:else}
                        back page
                    {/if}
                {:else if $documentType === "permit"}
                    Present your Residence Permit's
                    {#if !$DocFront}
                        front page
                    {:else}
                        back page
                    {/if}
                {/if}
            </div>

            {#if ($documentType !== "passport" && $image1Captured && $image2Captured) || ($documentType === "passport" && $image1Captured)}
                <!-- All photos captured - show retake option -->
                <div class="flex w-full gap-3">
                    <ButtonAction
                        color="alternative"
                        callback={retakeImages}
                        class="w-1/3 flex-1 flex items-center justify-center"
                    >
                        <svg
                            class="w-4 h-4 mr-1.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                        Retake
                    </ButtonAction>
                    <ButtonAction
                        disabled={loading}
                        callback={continueToSelfie}
                        class="flex-1"
                        color="primary">Continue</ButtonAction
                    >
                </div>
            {:else}
                <!-- Still capturing photos -->
                <ButtonAction
                    disabled={loading}
                    callback={captureImage}
                    class="w-full"
                    >{loading
                        ? "Processing..."
                        : image === 1
                          ? "Take Photo"
                          : "Take Back Photo"}</ButtonAction
                >
            {/if}
            <div class="mt-4 w-full">
                <!-- Preview thumbnails -->
                {#if $documentType === "passport"}
                    <!-- Passport needs no preview -->
                {:else}
                    <!-- Other documents need front and back -->
                    <div class="flex w-full justify-center gap-3 mb-6">
                        {#if $DocFront}
                            <div
                                class="relative h-[120px] w-full max-w-[177px] rounded-lg overflow-hidden border-2 border-purple-500 shadow-lg"
                            >
                                <img
                                    class="h-full w-full object-cover"
                                    src={$DocFront}
                                    alt="Document Front"
                                />
                                <div
                                    class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1"
                                >
                                    <p class="text-xs text-white font-medium">
                                        Front
                                    </p>
                                </div>
                            </div>
                        {:else}
                            <div
                                class="flex h-[120px] w-full max-w-[177px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-purple-500 transition-colors hover:border-purple-400"
                            >
                                <svg
                                    class="w-8 h-8 text-purple-500 mb-2"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                                    />
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                </svg>
                                <p class="text-sm text-gray-400 font-medium">
                                    Front
                                </p>
                            </div>
                        {/if}

                        {#if $DocBack}
                            <div
                                class="relative h-[120px] w-full max-w-[177px] rounded-lg overflow-hidden border-2 border-purple-500 shadow-lg"
                            >
                                <img
                                    class="h-full w-full object-cover"
                                    src={$DocBack}
                                    alt="Document Back"
                                />
                                <div
                                    class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1"
                                >
                                    <p class="text-xs text-white font-medium">
                                        Back
                                    </p>
                                </div>
                            </div>
                        {:else}
                            <div
                                class="flex h-[120px] w-full max-w-[177px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-purple-500 transition-colors hover:border-purple-400"
                            >
                                <svg
                                    class="w-8 h-8 text-purple-500 mb-2"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                                    />
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                </svg>
                                <p class="text-sm text-gray-400 font-medium">
                                    Back
                                </p>
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>

<CameraPermissionDialog
    isOpen={showPermissionDialog}
    onOpenSettings={handleOpenSettings}
    title="Camera Access Required"
    description="To capture your document, please grant camera permission in your device settings."
/>
