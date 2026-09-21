<script lang="ts">
import { m } from "$lib/paraglide/messages";
import type { PhotoMark } from "$lib/stores/personalBinding";
import { ButtonAction, CameraPermissionDialog } from "$lib/ui";
import BottomSheet from "$lib/ui/BottomSheet/BottomSheet.svelte";
import { createCameraPermissionManager } from "$lib/utils";
import { PERSONAL_BINDING_MAX_LENGTH } from "$lib/utils/personalBinding";
import { Cancel01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
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

async function chooseCamera() {
    pendingSource = "camera";
    const granted = await checkAndRequestPermission();
    if (!granted) {
        showPermissionDialog = true;
        return;
    }
    mode = "capture";
    // Wait for the <video> element to mount before binding the stream.
    queueMicrotask(async () => {
        try {
            const pending = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
            });
            // The sheet may have been closed while getUserMedia was pending
            // — if mode is no longer "capture" we'd otherwise leak the
            // stream after stopStream() ran with stream still null.
            if (!isOpen || mode !== "capture") {
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
    });
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
const sheetTitle = $derived(
    editing ? m.photo_sheet_edit_title() : m.photo_sheet_add_title(),
);
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
            aria-label={m.common_close()}
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
            <p class="text-black-500">{m.photo_take_from()}</p>
            <button
                type="button"
                onclick={chooseCamera}
                class="w-full bg-white border border-black-100 text-black-900 font-bold uppercase tracking-wide rounded-full py-4 active:bg-black-50"
            >
                {m.photo_source_camera()}
            </button>
            <button
                type="button"
                onclick={chooseGallery}
                class="w-full bg-white border border-black-100 text-black-900 font-bold uppercase tracking-wide rounded-full py-4 active:bg-black-50"
            >
                {m.photo_source_gallery()}
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
                    {m.photo_description_label()}
                </label>
                <input
                    id="photo-description-pre"
                    type="text"
                    bind:value={description}
                    maxlength={PERSONAL_BINDING_MAX_LENGTH}
                    placeholder={m.photo_description_placeholder()}
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
            <p class="text-black-500">{m.photo_taken_from_camera()}</p>
            <div class="relative w-full flex-1 min-h-0">
                <!-- svelte-ignore a11y_media_has_caption -->
                <video
                    bind:this={video}
                    autoplay
                    playsinline
                    class="absolute inset-0 w-full h-full rounded-2xl object-cover bg-black"
                ></video>
                <canvas bind:this={canvas} class="hidden"></canvas>
            </div>
            <ButtonAction class="w-full" callback={capturePhoto}>
                {m.photo_capture()}
            </ButtonAction>
        </div>
    {:else if mode === "preview" && pendingDataUrl}
        <div class="flex flex-col gap-4 flex-1">
            <p class="text-black-500">
                {pendingSource === "camera"
                    ? m.photo_taken_from_camera()
                    : m.photo_picked_from_gallery()}
            </p>

            <div class="relative w-full">
                <img
                    src={pendingDataUrl}
                    alt=""
                    class="w-full aspect-square rounded-2xl object-cover"
                />
                <button
                    type="button"
                    aria-label={m.photo_discard_aria()}
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
                    {m.photo_description_label()}
                </label>
                <input
                    id="photo-description"
                    type="text"
                    bind:value={description}
                    maxlength={PERSONAL_BINDING_MAX_LENGTH}
                    placeholder={m.photo_description_placeholder()}
                    class="w-full bg-card-alternative rounded-full px-5 py-4 placeholder:text-black-300 outline-none focus:ring-2 focus:ring-primary"
                />
                {#if description.length > PERSONAL_BINDING_MAX_LENGTH - 150}
                    <p class="text-xs text-black-500 text-right mt-1">
                        {description.length} / {PERSONAL_BINDING_MAX_LENGTH}
                    </p>
                {/if}
            </div>

            <ButtonAction class="w-full" callback={save}>{m.common_save()}</ButtonAction>
        </div>
    {/if}
</BottomSheet>

<CameraPermissionDialog
    isOpen={showPermissionDialog}
    onOpenSettings={handleOpenSettings}
    title={m.camera_permission_title()}
    description={m.photo_camera_permission_description()}
/>
