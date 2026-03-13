<script lang="ts">
import { page } from "$app/state";
import {
    PUBLIC_PICTIQUE_BASE_URL,
    PUBLIC_BLABSY_BASE_URL,
} from "$env/static/public";

const globalId = page.params.globalId;
const chatId = page.url.searchParams.get("chatId") || globalId;
const title = page.url.searchParams.get("title") || "";
const body = page.url.searchParams.get("body") || "";

async function openInApp(baseUrl: string) {
    const url = new URL(`/open-message/${encodeURIComponent(chatId)}`, baseUrl);
    try {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(url.toString());
    } catch {
        window.location.href = url.toString();
    }
}

function goBack() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        window.location.href = "/main";
    }
}
</script>

<div class="flex flex-col items-center justify-center min-h-screen p-6">
    {#if title}
        <p class="font-medium text-lg mb-1">{title}</p>
    {/if}
    {#if body}
        <p class="text-black-700 text-sm text-center max-w-sm mb-6">{body}</p>
    {/if}
    {#if !title && !body}
        <p class="font-medium text-lg mb-6">New Message</p>
    {/if}

    <p class="text-black-500 text-sm mb-6">Open this conversation in</p>

    <div class="flex flex-col gap-3 w-full max-w-xs">
        <button
            onclick={() => openInApp(PUBLIC_PICTIQUE_BASE_URL)}
            class="flex items-center gap-4 w-full px-5 py-4 bg-gray rounded-2xl active:opacity-80 transition-opacity"
        >
            <img
                src="/images/pictique-logo.svg"
                alt="Pictique"
                class="w-10 h-10 rounded-xl"
            />
            <span class="font-medium">Pictique</span>
        </button>

        <button
            onclick={() => openInApp(PUBLIC_BLABSY_BASE_URL)}
            class="flex items-center gap-4 w-full px-5 py-4 bg-gray rounded-2xl active:opacity-80 transition-opacity"
        >
            <img
                src="/images/blabsy-logo.svg"
                alt="Blabsy"
                class="w-10 h-10 rounded-xl"
            />
            <span class="font-medium">Blabsy</span>
        </button>

        <button
            onclick={goBack}
            class="w-full py-3 text-sm text-black-500 active:opacity-80 transition-opacity mt-2"
        >
            Cancel
        </button>
    </div>
</div>
