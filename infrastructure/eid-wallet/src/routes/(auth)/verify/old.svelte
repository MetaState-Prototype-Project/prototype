<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { Button } from "$lib";
    import { embedClient } from "$lib/axios/axios";
    import {
        DocBack,
        DocFront,
        permissionGranted,
        verifStep,
    } from "$lib/store/store";
    import { writable } from "svelte/store";

    let video: HTMLVideoElement;
    let canvas1: HTMLCanvasElement;
    let canvas2: HTMLCanvasElement;
    let image = 1;
    let image1Captured = writable(false);
    let image2Captured = writable(false);
    let documentType: "passport" | "id" | "permit" | "dl" | null = null;
    let loading = false;
    async function requestCameraPermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
            });
            video.srcObject = stream;
            video.play();
            permissionGranted.set(true);
        } catch (err) {
            permissionGranted.set(false);
            console.error("Camera permission denied", err);
        }
    }
    function watchForDocument(doc: typeof documentType) {
        if (doc !== null) {
            requestCameraPermission();
        }
    }

    $: watchForDocument(documentType);

    async function captureImage() {
        const id = $page.params.verificationId;
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
                await embedClient.post(`/verification/${id}/media`, {
                    img: dataUrl,
                    type: "document-front",
                });
                loading = false;
                image1Captured.set(true);
                image = 2;
            }
        } else if (
            (documentType === "passport" && $image1Captured) ||
            (image === 3 && $image1Captured && $image2Captured)
        ) {
            verifStep.update((n) => n + 1);
        } else if (image === 2) {
            console.log("hmmm?");
            const context2 = canvas2.getContext("2d");
            if (context2) {
                context2.drawImage(video, 0, 0, 1920, 1080);
                canvas2.width = video.videoWidth;
                canvas2.height = video.videoHeight;
                context2.drawImage(video, 0, 0, canvas2.width, canvas2.height);
                const dataUrl = canvas2.toDataURL("image/png");
                DocBack.set(dataUrl);
                image2Captured.set(true);
                image = 3;
                loading = true;
                await embedClient.post(`/verification/${id}/media`, {
                    img: dataUrl,
                    type: "document-back",
                });
                loading = false;
            }
        }
    }

    function retakeImages() {
        image1Captured.set(false);
        image2Captured.set(false);
        image = 1;
        const context1 = canvas1.getContext("2d");
        context1.clearRect(0, 0, canvas1.width, canvas1.height);
        const context2 = canvas2.getContext("2d");
        context2.clearRect(0, 0, canvas2.width, canvas2.height);
        DocFront.set(null);
        DocBack.set(null);
    }
</script>

<div class="flex flex-col items-center justify-center gap-5">
    <h1 class="mb-2 text-center text-xl font-extrabold text-white md:text-3xl">
        {#if documentType}
            Take a photo of your document’s {$DocFront ? "back" : "front"} page
        {:else}
            Choose from one of the following document types{/if}
    </h1>

    {#if documentType}
        <div class="flex flex-col items-center gap-1">
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
            <div class="flex w-full justify-center gap-2">
                {#if $DocFront}
                    <img
                        class="h-[100px] w-full max-w-[177px] object-cover"
                        src={$DocFront}
                        alt=""
                    />
                {:else}
                    <div
                        class="div flex h-[100px] w-full max-w-[177px] items-center justify-center rounded-md border-2 border-gray-600 bg-gray-700"
                    >
                        <h2>Document Front</h2>
                    </div>
                {/if}

                {#if documentType !== "passport"}
                    {#if $DocBack}
                        <img
                            class="h-[100px] w-full max-w-[177px] object-cover"
                            src={$DocBack}
                            alt=""
                        />
                    {:else}
                        <div
                            class="div flex h-[100px] w-full max-w-[177px] items-center justify-center rounded-md border-2 border-gray-600 bg-gray-700"
                        >
                            <h2>Document Back</h2>
                        </div>
                    {/if}
                {/if}
            </div>
        </div>
        <div class="text-center text-xs text-white">
            Accepted documents: Driver’s License, Residence Permit, Passport, ID
            Card.
        </div>
        {#if (documentType !== "passport" && $image1Captured && $image2Captured) || (documentType === "passport" && $image1Captured)}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
            <h2
                class="cursor-pointer rounded border-2 border-brand-green px-2 text-center font-medium text-brand-green_dark hover:border-green-200"
                on:click={() => {
                    retakeImages();
                }}
            >
                Retake
            </h2>
        {/if}
        <div
            class={`flex w-full flex-col items-center gap-4 border-t-2 border-t-gray-700 pt-4`}
        >
            <Button
                buttonClass="w-full"
                color={loading ? "alternative" : "primary"}
                disabled={loading}
                on:click={captureImage}
                >{loading
                    ? "Processing..."
                    : (documentType === "passport" && image === 2) ||
                        image === 3
                      ? "Done"
                      : "Take Photo"}</Button
            >
            <Button
                buttonClass="w-full"
                color="alternative"
                on:click={() => {
                    goto("/");
                    verifStep.set(0);
                }}>Cancel</Button
            >
        </div>
    {:else}
        <button
            class="w-full rounded-md border-2 px-4 py-2 dark:border-gray-600 dark:bg-gray-700"
            on:click={() => (documentType = "passport")}>Passport</button
        >
        <button
            class="w-full rounded-md border-2 px-4 py-2 dark:border-gray-600 dark:bg-gray-700"
            on:click={() => (documentType = "id")}>ID Card</button
        >
        <button
            class="w-full rounded-md border-2 px-4 py-2 dark:border-gray-600 dark:bg-gray-700"
            on:click={() => (documentType = "dl")}>Driving License</button
        >
        <button
            class="w-full rounded-md border-2 px-4 py-2 dark:border-gray-600 dark:bg-gray-700"
            on:click={() => (documentType = "permit")}>Residence Permit</button
        >
    {/if}
</div>
