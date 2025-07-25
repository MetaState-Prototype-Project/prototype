<script lang="ts">
import { PUBLIC_PROVISIONER_URL } from "$env/static/public";
import { ButtonAction } from "$lib/ui";
import axios from "axios";
import { onMount } from "svelte";
import { writable } from "svelte/store";
import {
    DocFront,
    permissionGranted,
    verifStep,
    verificaitonId,
} from "../store";

let error: string;

let video: HTMLVideoElement;
let canvas1: HTMLCanvasElement;
let canvas2: HTMLCanvasElement;
let image = 1;
let image1Captured = writable(false);
let loading = false;
let stream: MediaStream;

async function ensureCameraPermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
        });
        // Stop immediately after granting
        for (const track of stream.getTracks()) {
            track.stop();
        }
    } catch (err) {
        console.error("Camera permission denied:", err);
        throw err;
    }
}

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
    try {
        await ensureCameraPermission();
        stream = await getMainCameraStream();
        video.srcObject = stream;
        video.play();
        permissionGranted.set(true);
    } catch (err) {
        permissionGranted.set(false);
        console.error("Camera permission denied", err);
    }
}
async function captureImage() {
    if (image === 1) {
        console.log("huh?");
        const context1 = canvas1.getContext("2d");
        if (context1) {
            context1.drawImage(video, 0, 0, 1920, 1080);
            canvas1.width = video.videoWidth;
            canvas1.height = video.videoHeight;
            context1.drawImage(video, 0, 0, canvas1.width, canvas1.height);
            const dataUrl = canvas1.toDataURL("image/png");
            DocFront.set(dataUrl);
            loading = true;
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
            console.log("here???");
            loading = false;
            image1Captured.set(true);
            for (const track of stream.getTracks()) {
                track.stop();
            }
            verifStep.set(1);
        }
    }
}

onMount(() => {
    requestCameraPermission();
});
</script>

<div>
    {#if error}
        <div>{error}</div>
    {/if}
    <div class="flex flex-col h-[90vh]">
        <div class="flex flex-col items-center gap-1">
            <div class="mb-10">
                <h3>Present your Passport</h3>
                <p>
                    Please place your passport's photo page within the rectangle
                    and press the take photo button
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
            <ButtonAction
                disabled={loading}
                callback={captureImage}
                class="w-full"
                >{loading ? "Processing..." : "Take Photo"}</ButtonAction
            >
        </div>
    </div>
</div>
