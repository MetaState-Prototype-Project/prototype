<script lang="ts">
import { BottomSheet } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import { QRIcon } from "$lib/ui/icons";
import { Copy01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import QrCode from "svelte-qrcode";

interface IENameCardProps {
    ename: string | undefined;
    /** True once at least one id_document binding doc is signed off — flips
     *  the chip from the gray "Unverified ID" to the green "Verified ID"
     *  variant. */
    verified?: boolean;
    /** Called with a message to surface as a toast (copy success/failure). */
    ontoast?: (message: string) => void;
}

const { ename, verified = false, ontoast }: IENameCardProps = $props();

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

<section
    class="bg-white rounded-2xl p-4 shadow-[0px_4px_19.9px_0px_#00000024]"
>
    <div class="flex items-center justify-between gap-3 mb-3">
        <h3 class="text-lg font-medium text-black-900">Your eName</h3>
        {#if verified}
            <span
                class="bg-lime-200 text-lime-900 text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-full"
            >
                Verified ID
            </span>
        {:else}
            <span
                class="bg-black-50 text-black-700 text-[13px] font-bold uppercase tracking-wide px-3 py-1 rounded-full"
            >
                Unverified ID
            </span>
        {/if}
    </div>
    <div class="flex items-end justify-between gap-3">
        <p class="text-black-700 opacity-50 font-medium break-all flex-1 min-w-0 leading-snug">
            {ename ?? "Loading..."}<button
                type="button"
                onclick={copyEName}
                aria-label="Copy eName"
                class="inline-flex align-middle active:opacity-60 ml-1.5"
            >
                <HugeiconsIcon icon={Copy01Icon} size={16} strokeWidth={3} />
            </button>
        </p>
        <button
            type="button"
            onclick={() => (shareQRdrawerOpen = true)}
            aria-label="Show QR code"
            class="text-black-300 active:opacity-60 shrink-0"
        >
            <QRIcon size={20} />
        </button>
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
