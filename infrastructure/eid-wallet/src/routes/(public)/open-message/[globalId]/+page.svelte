<script lang="ts">
import { page } from "$app/state";
import {
    PUBLIC_PICTIQUE_BASE_URL,
    PUBLIC_BLABSY_BASE_URL,
} from "$env/static/public";

const globalId = page.params.globalId;
const chatId = page.url.searchParams.get("chatId") || globalId;

function openInPictique() {
    window.location.href = `${PUBLIC_PICTIQUE_BASE_URL}/open-message/${encodeURIComponent(chatId)}`;
}

function openInBlabsy() {
    window.location.href = `${PUBLIC_BLABSY_BASE_URL}/open-message/${encodeURIComponent(chatId)}`;
}
</script>

<div class="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
    <h1 class="text-xl font-semibold text-gray-800 mb-2">New Message</h1>
    <p class="text-gray-500 mb-8">Choose where to open this message</p>

    <div class="flex flex-col gap-4 w-full max-w-xs">
        <button
            onclick={openInPictique}
            class="flex items-center gap-4 w-full px-6 py-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all"
        >
            <img
                src="/images/pictique-logo.png"
                alt="Pictique"
                class="w-10 h-10 rounded-lg"
            />
            <span class="text-lg font-medium text-gray-800">Open in Pictique</span>
        </button>

        <button
            onclick={openInBlabsy}
            class="flex items-center gap-4 w-full px-6 py-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all"
        >
            <img
                src="/images/blabsy-logo.svg"
                alt="Blabsy"
                class="w-10 h-10 rounded-lg"
            />
            <span class="text-lg font-medium text-gray-800">Open in Blabsy</span>
        </button>
    </div>
</div>
