<script lang="ts">
import { BottomSheet } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import { Copy01Icon, QrCodeIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import QrCode from "svelte-qrcode";

interface IENameCardProps {
    ename: string | undefined;
    /** Called with a message to surface as a toast (copy success/failure). */
    ontoast?: (message: string) => void;
}

const { ename, ontoast }: IENameCardProps = $props();

let shareQRdrawerOpen = $state(false);

async function copyEName() {
    if (!ename) return;
    try {
        await navigator.clipboard.writeText(ename);
        ontoast?.("eName copied to clipboard!");
    } catch (error) {
        console.error("Failed to copy eName:", error);
        ontoast?.("Failed to copy eName");
    }
}

function shareQR() {
    alert("QR Code shared!");
    shareQRdrawerOpen = false;
}
</script>

<section class="bg-white rounded-2xl border border-black-100 p-4 shadow-sm">
    <div class="flex items-center justify-between gap-3 mb-1">
        <p class="text-sm text-black-500">Your eName</p>
        <span
            class="bg-black-100 text-black-700 text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-full"
        >
            Unverified ID
        </span>
    </div>
    <div class="flex items-start justify-between gap-3">
        <p class="font-medium text-black-900 break-all flex-1 leading-snug">
            {ename ?? "Loading..."}
        </p>
        <div class="flex items-center gap-2 shrink-0 pt-0.5">
            <button
                type="button"
                onclick={copyEName}
                aria-label="Copy eName"
                class="text-black-700 active:opacity-60"
            >
                <HugeiconsIcon icon={Copy01Icon} size={20} strokeWidth={2} />
            </button>
            <button
                type="button"
                onclick={() => (shareQRdrawerOpen = true)}
                aria-label="Show QR code"
                class="text-black-700 active:opacity-60"
            >
                <HugeiconsIcon icon={QrCodeIcon} size={20} strokeWidth={2} />
            </button>
        </div>
    </div>
</section>

<BottomSheet
    title="Scan QR Code"
    bind:isOpen={shareQRdrawerOpen}
    class="flex flex-col gap-4 items-center justify-center"
>
    <div
        class="flex justify-center relative items-center overflow-hidden h-full rounded-3xl p-8 pt-0"
    >
        <QrCode size={320} value={ename ?? ""} />
    </div>

    <h4 class="text-center mt-2">Share your eName</h4>
    <p class="text-black-700 text-center">
        Anyone scanning this can see your eName
    </p>
    <div class="flex justify-center items-center mt-4">
        <Button.Action variant="solid" callback={shareQR} class="w-full">
            Share
        </Button.Action>
    </div>
</BottomSheet>
