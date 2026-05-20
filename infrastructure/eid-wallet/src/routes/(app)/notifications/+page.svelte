<script lang="ts">
import { goto } from "$app/navigation";
import { AppNav } from "$lib/fragments";
import {
    type StoredNotification,
    clearAllNotifications,
    clearNotificationsForChat,
    getNotifications,
    seedDummyNotifications,
    subscribe,
} from "$lib/stores/notifications";
import { onDestroy, onMount } from "svelte";

let notifications: StoredNotification[] = $state([]);
let loaded = $state(false);
let unsubscribe: (() => void) | undefined;

function refresh() {
    notifications = getNotifications();
}

onMount(() => {
    refresh();
    loaded = true;
    unsubscribe = subscribe(refresh);
});

onDestroy(() => {
    unsubscribe?.();
});

function handleNotificationClick(notification: StoredNotification) {
    const data = notification.data;
    if (
        data?.type === "new_message" &&
        (data.globalMessageId || data.globalChatId)
    ) {
        const messageId = data.globalMessageId || data.globalChatId || "";
        const chatId = data.globalChatId ?? messageId;
        // Clear all notifications from the same chat
        clearNotificationsForChat(chatId);
        // Navigate to open-message page
        goto(
            `/open-message/${encodeURIComponent(messageId)}?chatId=${encodeURIComponent(chatId)}&title=${encodeURIComponent(notification.title)}&body=${encodeURIComponent(notification.body)}`,
        );
    }
}

function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
}

function handleClearAll() {
    clearAllNotifications();
    refresh();
}

const isDev = import.meta.env.DEV;
function handleSeedDummy() {
    seedDummyNotifications();
    refresh();
}
</script>

<AppNav title="Notifications" />

{#if notifications.length > 0 || isDev}
    <div class="flex justify-end gap-4 mb-4">
        {#if isDev}
            <button
                onclick={handleSeedDummy}
                class="text-sm text-black-500"
            >
                Seed dummy
            </button>
        {/if}
        {#if notifications.length > 0}
            <button
                onclick={handleClearAll}
                class="text-sm text-primary"
            >
                Clear all
            </button>
        {/if}
    </div>
{/if}

{#if !loaded}
    <div class="flex flex-col items-center justify-center mt-20">
        <p class="text-sm text-black-500">Loading...</p>
    </div>
{:else if notifications.length === 0}
    <div class="flex flex-col items-center justify-center mt-20">
        <p class="text-lg text-black-700">No notifications</p>
        <p class="text-sm text-black-500 mt-1">You're all caught up</p>
    </div>
{:else}
    <div class="flex flex-col gap-4">
        {#each notifications as notification (notification.id)}
            <button
                onclick={() => handleNotificationClick(notification)}
                class="w-full text-left bg-white rounded-2xl p-4 shadow-card active:opacity-90 transition-opacity flex items-start gap-3"
            >
                <div class="flex-1 min-w-0">
                    <p class="font-bold text-black-900 leading-tight">
                        {notification.title}
                    </p>
                    {#if notification.body}
                        <p
                            class="text-black-500 mt-1 leading-snug line-clamp-2"
                        >
                            {notification.body}
                        </p>
                    {/if}
                    <p class="text-black-500 mt-2 leading-tight">
                        {formatTime(notification.createdAt)}
                    </p>
                </div>
                {#if notification.data?.avatar}
                    <img
                        src={notification.data.avatar}
                        alt=""
                        class="w-12 h-12 rounded-2xl object-cover shrink-0"
                        aria-hidden="true"
                    />
                {/if}
            </button>
        {/each}
    </div>
{/if}
