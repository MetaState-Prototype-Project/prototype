<script lang="ts">
import { getPlatformKey } from "@metastate-foundation/platform-icons";
import blabsy from "@metastate-foundation/platform-icons/icons/blabsy.svg";
import charter from "@metastate-foundation/platform-icons/icons/charter.png";
import ecurrency from "@metastate-foundation/platform-icons/icons/ecurrency.png";
import eidW3ds from "@metastate-foundation/platform-icons/icons/eid-w3ds.png";
import emover from "@metastate-foundation/platform-icons/icons/emover.png";
import ereputation from "@metastate-foundation/platform-icons/icons/ereputation.png";
import esigner from "@metastate-foundation/platform-icons/icons/esigner.png";
import evoting from "@metastate-foundation/platform-icons/icons/evoting.png";
import fileManager from "@metastate-foundation/platform-icons/icons/file-manager.png";
import marketplace from "@metastate-foundation/platform-icons/icons/marketplace.ico";
import pictique from "@metastate-foundation/platform-icons/icons/pictique.svg";
import profileEditor from "@metastate-foundation/platform-icons/icons/profile-editor.png";
import w3ds from "@metastate-foundation/platform-icons/icons/w3dslogo.svg";
/**
 * App card for platform-based scan drawers (auth, signing, reveal, logged in).
 *
 * Icon resolution cascade:
 *   1. `@metastate-foundation/platform-icons` — local bundled brand icons
 *      keyed by subdomain (covers all Metastate platforms).
 *   2. `https://{hostname}/apple-touch-icon.png` — third-party platforms
 *      that ship a high-res touch icon.
 *   3. `https://{hostname}/favicon.ico` — fallback for older platforms.
 *   4. White initial letter on a primary-tinted square — last resort.
 *
 * Layout: icon and card are stacked flex children — `-mb-8` on the icon
 * pulls the card up so the icon's lower half overlaps the card's top.
 */
import { untrack } from "svelte";

const LOCAL_ICONS: Record<string, string> = {
    blabsy,
    charter,
    ecurrency,
    "eid-w3ds": eidW3ds,
    emover,
    ereputation,
    esigner,
    evoting,
    "file-manager": fileManager,
    marketplace,
    pictique,
    "profile-editor": profileEditor,
    w3ds,
};

interface IPlatformAppCardProps {
    hostname: string | null | undefined;
    platformName: string | null | undefined;
    class?: string;
}

const {
    hostname,
    platformName,
    class: classes = "",
}: IPlatformAppCardProps = $props();

type Stage = "local" | "apple" | "favicon" | "fallback";

const localKey = $derived(getPlatformKey(hostname));
const localUrl = $derived(localKey ? (LOCAL_ICONS[localKey] ?? null) : null);

// Start at the first stage that could produce a URL — skip "local" when we
// have no bundled icon, so the cascade doesn't wait on a load/error event
// that will never fire.
let stage = $state<Stage>(
    untrack(() => (localUrl ? "local" : hostname ? "apple" : "fallback")),
);

const iconUrl = $derived(
    stage === "local"
        ? localUrl
        : stage === "apple"
          ? `https://${hostname}/apple-touch-icon.png`
          : stage === "favicon"
            ? `https://${hostname}/favicon.ico`
            : null,
);

function handleError() {
    if (stage === "local") stage = hostname ? "apple" : "fallback";
    else if (stage === "apple") stage = "favicon";
    else if (stage === "favicon") stage = "fallback";
}

// Some servers return 200 OK with an HTML page or a tiny placeholder for
// missing `/apple-touch-icon.png`, so `onerror` never fires. Treat
// suspiciously small loads as failures and advance the cascade.
function handleLoad(e: Event) {
    const img = e.currentTarget as HTMLImageElement;
    if (img.naturalWidth < 8 || img.naturalHeight < 8) {
        handleError();
    }
}

const initial = $derived((platformName?.[0] ?? "?").toUpperCase());
const displayName = $derived(platformName ?? "Unknown app");
</script>

<div class="flex flex-col items-center w-full {classes}">
    <div
        class="relative z-10 w-16 h-16 rounded-2xl overflow-hidden bg-primary flex items-center justify-center -mb-8"
    >
        {#if iconUrl}
            <img
                src={iconUrl}
                alt={`${displayName} icon`}
                onerror={handleError}
                onload={handleLoad}
                class="w-full h-full object-cover"
            />
        {:else}
            <span class="text-2xl font-bold text-white">{initial}</span>
        {/if}
    </div>
    <div
        class="bg-white rounded-3xl shadow-card pt-12 pb-6 px-6 flex flex-col items-center gap-2 w-full"
    >
        <h3 class="text-2xl font-bold text-black-900 capitalize text-center">
            {displayName}
        </h3>
        {#if hostname}
            <p class="text-black-500 break-all text-center">
                {hostname}
            </p>
        {/if}
    </div>
</div>
