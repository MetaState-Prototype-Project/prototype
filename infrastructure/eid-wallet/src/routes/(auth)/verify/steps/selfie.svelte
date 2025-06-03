<script lang="ts">
    import { writable } from "svelte/store";
    import { ButtonAction } from "$lib/ui";
    import {
        Selfie,
        permissionGranted,
        verifStep,
        verificaitonId,
    } from "../store";
    import { onMount } from "svelte";
    import { Shadow } from "svelte-loading-spinners";
    import axios from "axios";
    import { PUBLIC_PROVISIONER_URL } from "$env/static/public";

    let video: HTMLVideoElement;
    let canvas: HTMLCanvasElement;
    let image = 1;
    let imageCaptured = writable(false);
    let load = false;

    onMount(() => {
        async function requestCameraPermission() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
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
        requestCameraPermission();
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
            }
        } else if (image === 2 && $imageCaptured) {
            verifStep.update((n) => n + 1);
        }
    }
</script>

<div class="flex flex-col gap-5">
    {#if !load}
        <div>
            <h3>Take a Selfie</h3>
            <p>
                Place your face in the center of the circle and press the take
                photo button
            </p>
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
        <div class="text-center text-xs text-white">
            Please make sure that your face is in the frame and clearly visible.
        </div>

        <ButtonAction class="w-full" callback={captureImage}
            >{"Take Photo"}</ButtonAction
        >
    {:else}
        <div class="my-20">
            <div
                class="align-center flex w-full flex-col items-center justify-center gap-6"
            >
                <Shadow size={40} color="rgb(142, 82, 255);" />
                <h3>Verifying your identity</h3>
            </div>
        </div>
    {/if}
</div>
