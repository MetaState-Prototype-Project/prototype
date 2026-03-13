<script lang="ts">
import { goto } from "$app/navigation";
import {
    getNotifications,
    clearNotificationsForChat,
    clearAllNotifications,
    subscribe,
    type StoredNotification,
} from "$lib/stores/notifications";
import { onMount, onDestroy } from "svelte";

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
    if (data?.type === "new_message" && data.globalMessageId) {
        // Clear all notifications from the same chat
        if (data.globalChatId) {
            clearNotificationsForChat(data.globalChatId);
        }
        // Navigate to open-message page
        goto(
            `/open-message/${encodeURIComponent(data.globalMessageId)}?chatId=${encodeURIComponent(data.globalChatId || data.globalMessageId)}`,
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
</script>

<div class="flex items-center justify-between mb-6">
    <button onclick={() => goto("/main")} class="text-gray-500 text-sm">
        &larr; Back
    </button>
    <h1 class="text-xl font-semibold">Notifications</h1>
    {#if notifications.length > 0}
        <button
            onclick={clearAllNotifications}
            class="text-sm text-blue-500"
        >
            Clear all
        </button>
    {:else}
        <div class="w-16"></div>
    {/if}
</div>

{#if notifications.length === 0}
    <div class="flex flex-col items-center justify-center mt-20 text-gray-400">
        <p class="text-lg">No notifications</p>
        <p class="text-sm mt-1">You're all caught up</p>
    </div>
{:else}
    <div class="flex flex-col gap-2">
        {#each notifications as notification (notification.id)}
            <button
                onclick={() => handleNotificationClick(notification)}
                class="w-full text-left p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-all"
            >
                <div class="flex justify-between items-start">
                    <h3 class="font-medium text-gray-800 text-sm">
                        {notification.title}
                    </h3>
                    <span class="text-xs text-gray-400 ml-2 shrink-0">
                        {formatTime(notification.createdAt)}
                    </span>
                </div>
                {#if notification.body}
                    <p class="text-sm text-gray-500 mt-1 line-clamp-2">
                        {notification.body}
                    </p>
                {/if}
            </button>
        {/each}
    </div>
{/if}
