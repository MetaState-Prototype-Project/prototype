<script lang="ts">
import type { PhotoMark } from "$lib/stores/personalBinding";
import { ButtonAction, CameraPermissionDialog } from "$lib/ui";
import BottomSheet from "$lib/ui/BottomSheet/BottomSheet.svelte";
import { createCameraPermissionManager } from "$lib/utils";
import { PERSONAL_BINDING_MAX_LENGTH } from "$lib/utils/personalBinding";
import {
    CameraRotated01Icon,
    Cancel01Icon,
    Delete02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";

interface IAddPhotoSheetProps {
    isOpen: boolean;
    /** When set, the sheet skips the source picker and lands on the preview
     *  for editing the existing photo's description. */
    editing?: PhotoMark | null;
    /** Form payload — the page persists + closes. `editing` distinguishes
     *  add vs edit; the form data shape is the same. */
    onsave?: (data: {
        dataUrl: string;
        description: string;
        source: "camera" | "gallery";
    }) => void;
    onOpenChange?: (open: boolean) => void;
}

const {
    isOpen,
    editing = null,
    onsave,
    onOpenChange,
}: IAddPhotoSheetProps = $props();

// Mode within the sheet:
//   pick     → "Take from" Camera/Gallery picker (partial bottom sheet)
//   capture  → live camera viewfinder (full screen)
//   preview  → captured/picked photo + description form (full screen)
type Mode = "pick" | "capture" | "preview";
let mode = $state<Mode>("pick");

let pendingDataUrl = $state<string | null>(null);
let pendingSource = $state<"camera" | "gallery">("camera");
let description = $state("");

let video = $state<HTMLVideoElement | null>(null);
let canvas = $state<HTMLCanvasElement | null>(null);
let stream: MediaStream | null = null;
let galleryInput = $state<HTMLInputElement | null>(null);

// Which camera to use. The back camera is the default; users can flip to
// the front (selfie) camera from the viewfinder. On desktop "environment"
// is advisory and resolves to the only available camera anyway.
let facingMode = $state<"user" | "environment">("environment");
// Bumped on every (re)start so a slow getUserMedia belonging to a
// superseded request (e.g. a rapid flip) can detect it lost the race
// and release its stream instead of binding a stale one.
let streamToken = 0;

const cameraPermission = createCameraPermissionManager();
const { checkAndRequestPermission, openSettings } = cameraPermission;
let showPermissionDialog = $state(false);

// Initialize from props each time the sheet opens.
$effect(() => {
    if (!isOpen) return;
    if (editing) {
        pendingDataUrl = editing.dataUrl;
        pendingSource = editing.source;
        description = editing.description;
        mode = "preview";
    } else {
        resetState();
    }
});

// Stop camera stream whenever we leave the capture mode.
$effect(() => {
    if (mode !== "capture") stopStream();
});

function resetState() {
    mode = "pick";
    pendingDataUrl = null;
    pendingSource = "camera";
    description = "";
}

function close() {
    stopStream();
    resetState();
    onOpenChange?.(false);
}

function stopStream() {
    if (!stream) return;
    for (const track of stream.getTracks()) track.stop();
    stream = null;
}

const BACK_LABEL = /back|rear|environment/i;
const FRONT_LABEL = /front|face|user|selfie/i;

// The main rear sensor, resolved once and cached — flipping back to it then
// costs a single getUserMedia instead of re-probing every camera.
let backDeviceId: string | undefined;

// Open a working stream for the requested facing.
//   - Front: a plain facingMode constraint is reliable and fast.
//   - Back: the default rear device is often a secondary sensor (ultrawide /
//     depth) that streams a black frame, so we locate the *main* rear sensor
//     by its torch capability (the technique the KYC scanner uses) and cache
//     it. The probe stream for the winning camera is reused, so the main
//     camera is opened only once.
async function openCameraStream(
    facing: "user" | "environment",
): Promise<MediaStream> {
    if (facing === "user") {
        return navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
        });
    }
    if (backDeviceId) {
        return navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: backDeviceId } },
        });
    }

    let cams = (await navigator.mediaDevices.enumerateDevices()).filter(
        (d) => d.kind === "videoinput",
    );
    // Labels stay empty until the session has been granted a getUserMedia;
    // prime with a throwaway stream so we can tell rear cameras from front.
    if (cams.length && cams.every((d) => !d.label)) {
        try {
            const primer = await navigator.mediaDevices.getUserMedia({
                video: true,
            });
            for (const t of primer.getTracks()) t.stop();
            cams = (await navigator.mediaDevices.enumerateDevices()).filter(
                (d) => d.kind === "videoinput",
            );
        } catch {
            // Ignore — fall through to whatever labels we have.
        }
    }

    // Candidate rear cameras: those labelled back, or (labels hidden)
    // everything that isn't explicitly a front camera.
    const labelledBack = cams.filter((d) => BACK_LABEL.test(d.label));
    const candidates = labelledBack.length
        ? labelledBack
        : cams.filter((d) => !FRONT_LABEL.test(d.label));

    // The main rear sensor is the one exposing a torch. Probe each candidate
    // and reuse the winner's stream rather than reopening it.
    for (const cam of candidates) {
        try {
            const probe = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: cam.deviceId } },
            });
            const caps = probe.getVideoTracks()[0]?.getCapabilities?.();
            if (caps && "torch" in caps) {
                backDeviceId = cam.deviceId;
                return probe;
            }
            for (const t of probe.getTracks()) t.stop();
        } catch {
            // Skip cameras we can't open.
        }
    }

    // No torch found (desktop, or a webview that hides capabilities): fall
    // back to the last rear candidate — conventionally the main camera — or a
    // plain facingMode constraint if we couldn't enumerate anything.
    const fallback = candidates.at(-1) ?? cams.at(-1);
    backDeviceId = fallback?.deviceId;
    return navigator.mediaDevices.getUserMedia({
        video: fallback
            ? { deviceId: { exact: fallback.deviceId } }
            : { facingMode: "environment" },
    });
}

// (Re)start the viewfinder stream for the current `facingMode`. Tears down
// any existing stream first so flipping cameras releases the old one.
async function startStream() {
    const token = ++streamToken;
    stopStream();
    try {
        const pending = await openCameraStream(facingMode);
        // A superseded request (rapid flip / close) may have moved on while
        // we were opening the camera — release the stream if we lost the race
        // so we don't leak it or bind a stale one.
        if (!isOpen || mode !== "capture" || token !== streamToken) {
            for (const track of pending.getTracks()) track.stop();
            return;
        }
        stream = pending;
        if (video) {
            video.srcObject = stream;
            await video.play();
        }
    } catch (err) {
        console.error("[personal] camera error", err);
        showPermissionDialog = true;
        mode = "pick";
    }
}

async function chooseCamera() {
    pendingSource = "camera";
    const granted = await checkAndRequestPermission();
    if (!granted) {
        showPermissionDialog = true;
        return;
    }
    // Default to the back camera each time the viewfinder is opened.
    facingMode = "environment";
    mode = "capture";
    // Wait for the <video> element to mount before binding the stream.
    queueMicrotask(startStream);
}

// Toggle between front (selfie) and back cameras, restarting the stream.
function flipCamera() {
    facingMode = facingMode === "user" ? "environment" : "user";
    startStream();
}

function chooseGallery() {
    pendingSource = "gallery";
    galleryInput?.click();
}

function handleGalleryFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        pendingDataUrl = reader.result as string;
        mode = "preview";
    };
    reader.readAsDataURL(file);
}

function capturePhoto() {
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    pendingDataUrl = canvas.toDataURL("image/jpeg", 0.85);
    stopStream();
    mode = "preview";
}

function discardPhoto() {
    pendingDataUrl = null;
    mode = "pick";
}

async function handleOpenSettings() {
    await openSettings();
    showPermissionDialog = false;
    await chooseCamera();
}

function save() {
    if (!pendingDataUrl) return;
    onsave?.({
        dataUrl: pendingDataUrl,
        description: description.trim(),
        source: pendingSource,
    });
    close();
}

const fullScreen = $derived(mode !== "pick");
const sheetTitle = $derived(editing ? "Edit photo mark" : "Add photo mark");
</script>

<BottomSheet
    {isOpen}
    {fullScreen}
    dismissible
    onOpenChange={(v) => {
        if (!v) close();
    }}
>
    <!-- Header — only the full-screen modes use a real close button; the
         partial picker uses the BottomSheet's outside-click dismiss. -->
    <header class="flex items-center justify-between">
        <h2 class="text-2xl font-bold text-black-900">{sheetTitle}</h2>
        <button
            type="button"
            aria-label="Close"
            class="w-9 h-9 rounded-full bg-black-50 flex items-center justify-center active:opacity-70"
            onclick={close}
        >
            <HugeiconsIcon
                icon={Cancel01Icon}
                size={18}
                strokeWidth={2}
            />
        </button>
    </header>

    {#if mode === "pick"}
        <div class="flex flex-col gap-3 mt-2">
            <p class="text-black-500">Take from</p>
            <button
                type="button"
                onclick={chooseCamera}
                class="w-full bg-white border border-black-100 text-black-900 font-bold uppercase tracking-wide rounded-full py-4 active:bg-black-50"
            >
                Camera
            </button>
            <button
                type="button"
                onclick={chooseGallery}
                class="w-full bg-white border border-black-100 text-black-900 font-bold uppercase tracking-wide rounded-full py-4 active:bg-black-50"
            >
                Gallery
            </button>
            <input
                bind:this={galleryInput}
                type="file"
                accept="image/*"
                class="hidden"
                onchange={handleGalleryFile}
            />

            <div class="mt-4">
                <label
                    for="photo-description-pre"
                    class="block text-black-500 mb-2"
                >
                    Description
                </label>
                <input
                    id="photo-description-pre"
                    type="text"
                    bind:value={description}
                    maxlength={PERSONAL_BINDING_MAX_LENGTH}
                    placeholder="Describe this photo"
                    class="w-full bg-card-alternative rounded-full px-5 py-4 placeholder:text-black-300 outline-none focus:ring-2 focus:ring-primary"
                />
                {#if description.length > PERSONAL_BINDING_MAX_LENGTH - 150}
                    <p class="text-xs text-black-500 text-right mt-1">
                        {description.length} / {PERSONAL_BINDING_MAX_LENGTH}
                    </p>
                {/if}
            </div>
        </div>
    {:else if mode === "capture"}
        <div class="flex flex-col gap-4 flex-1">
            <p class="text-black-500">Taken from camera</p>
            <div class="relative w-full flex-1 min-h-0">
                <!-- svelte-ignore a11y_media_has_caption -->
                <video
                    bind:this={video}
                    autoplay
                    playsinline
                    class="absolute inset-0 w-full h-full rounded-2xl object-cover bg-black"
                ></video>
                <canvas bind:this={canvas} class="hidden"></canvas>
                <button
                    type="button"
                    aria-label="Switch camera"
                    class="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center active:opacity-70"
                    onclick={flipCamera}
                >
                    <HugeiconsIcon
                        icon={CameraRotated01Icon}
                        size={20}
                        strokeWidth={2}
                        color="white"
                    />
                </button>
            </div>
            <ButtonAction class="w-full" callback={capturePhoto}>
                Capture
            </ButtonAction>
        </div>
    {:else if mode === "preview" && pendingDataUrl}
        <div class="flex flex-col gap-4 flex-1">
            <p class="text-black-500">
                {pendingSource === "camera"
                    ? "Taken from camera"
                    : "Picked from gallery"}
            </p>

            <div class="relative w-full">
                <img
                    src={pendingDataUrl}
                    alt=""
                    class="w-full aspect-square rounded-2xl object-cover"
                />
                <button
                    type="button"
                    aria-label="Discard photo"
                    class="absolute top-3 right-3 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center active:opacity-70"
                    onclick={discardPhoto}
                >
                    <HugeiconsIcon
                        icon={Delete02Icon}
                        size={18}
                        strokeWidth={2}
                    />
                </button>
            </div>

            <div>
                <label
                    for="photo-description"
                    class="block text-black-500 mb-2"
                >
                    Description
                </label>
                <input
                    id="photo-description"
                    type="text"
                    bind:value={description}
                    maxlength={PERSONAL_BINDING_MAX_LENGTH}
                    placeholder="Describe this photo"
                    class="w-full bg-card-alternative rounded-full px-5 py-4 placeholder:text-black-300 outline-none focus:ring-2 focus:ring-primary"
                />
                {#if description.length > PERSONAL_BINDING_MAX_LENGTH - 150}
                    <p class="text-xs text-black-500 text-right mt-1">
                        {description.length} / {PERSONAL_BINDING_MAX_LENGTH}
                    </p>
                {/if}
            </div>

            <ButtonAction class="w-full" callback={save}>Save</ButtonAction>
        </div>
    {/if}
</BottomSheet>

<CameraPermissionDialog
    isOpen={showPermissionDialog}
    onOpenSettings={handleOpenSettings}
    title="Camera Access Required"
    description="To capture a photo mark, please grant camera permission in your device settings."
/>
