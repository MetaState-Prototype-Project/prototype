<script lang="ts">
import { goto } from "$app/navigation";
import { AppNav } from "$lib/fragments";
import {
    type StoredNotification,
    clearAllNotifications,
    clearNotificationsForChat,
    getNotifications,
    subscribe,
} from "$lib/stores/notifications";
import { onDestroy, onMount } from "svelte";

let notifications: StoredNotification[] = $state([]);
let unsubscribe: (() => void) | undefined;

function refresh() {
    notifications = getNotifications();
}

onMount(() => {
    refresh();
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
</script>

<AppNav title="Notifications" />

{#if notifications.length > 0}
    <div class="flex justify-end mb-4">
        <button
            onclick={handleClearAll}
            class="text-sm text-primary"
        >
            Clear all
        </button>
    </div>
{/if}

{#if notifications.length === 0}
    <div class="flex flex-col items-center justify-center mt-20">
        <p class="text-lg text-black-700">No notifications</p>
        <p class="text-sm text-black-500 mt-1">You're all caught up</p>
    </div>
{:else}
    <div class="flex flex-col gap-3">
        {#each notifications as notification (notification.id)}
            <button
                onclick={() => handleNotificationClick(notification)}
                class="w-full text-left p-4 bg-gray rounded-2xl active:opacity-80 transition-opacity"
            >
                <div class="flex justify-between items-start">
                    <p class="font-medium text-sm">
                        {notification.title}
                    </p>
                    <span class="text-xs text-black-500 ml-2 shrink-0">
                        {formatTime(notification.createdAt)}
                    </span>
                </div>
                {#if notification.body}
                    <p class="text-sm text-black-700 mt-1 line-clamp-2">
                        {notification.body}
                    </p>
                {/if}
            </button>
        {/each}
    </div>
{/if}
