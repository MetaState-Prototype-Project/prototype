<script lang="ts">
import { PUBLIC_PROVISIONER_URL } from "$env/static/public";
import { ButtonAction } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { goto } from "$app/navigation";
import axios from "axios";
import { onMount } from "svelte";
import { Shadow } from "svelte-loading-spinners";
import { writable } from "svelte/store";
import { Selfie, permissionGranted, verifStep, verificaitonId } from "../store";

let video: HTMLVideoElement;
let canvas: HTMLCanvasElement;
let image = 1;
let imageCaptured = writable(false);
let load = false;
let stream: MediaStream;

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

onMount(() => {
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
            // verifStep will be set to 3 by the websocket event
            // When results are ready, the verify page will handle showing the drawer
        }
    }
}
</script>

<div class="flex flex-col gap-5">
    {#if !load}
        <div class="flex flex-col gap-2 mb-2">
            <Button.Icon
                icon={ArrowLeft01Icon}
                iconColor="black"
                strokeWidth={2}
                onclick={() => {
                    if (stream) {
                        for (const track of stream.getTracks()) {
                            track.stop();
                        }
                    }
                    goto("/verify/passport");
                }}
                class="cursor-pointer self-start"
            />
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
    {:else}
        <div class="fixed inset-0 flex items-center justify-center bg-white z-50">
            <div
                class="flex flex-col items-center justify-center gap-6"
            >
                <Shadow size={40} color="rgb(142, 82, 255);" />
                <h3>Verifying your identity</h3>
            </div>
        </div>
    {/if}
</div>
