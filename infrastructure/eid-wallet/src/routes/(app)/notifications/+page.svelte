<script lang="ts">
import { goto } from "$app/navigation";
import { AppNav } from "$lib/fragments";
import { m } from "$lib/paraglide/messages";
import { getLocale } from "$lib/paraglide/runtime";
import {
    type StoredNotification,
    clearAllNotifications,
    clearNotificationsForChat,
    getNotifications,
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

    if (diffMin < 1) return m.notif_time_just_now();
    if (diffMin < 60) return m.notif_time_minutes_ago({ count: diffMin });

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return m.notif_time_hours_ago({ count: diffHours });

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return m.notif_time_days_ago({ count: diffDays });

    return date.toLocaleDateString(getLocale());
}

function handleClearAll() {
    clearAllNotifications();
    refresh();
}
</script>

<AppNav title={m.settings_notifications()} />

{#if notifications.length > 0}
    <div class="flex justify-end mb-4">
        <button onclick={handleClearAll} class="text-sm text-primary">
            {m.notif_clear_all()}
        </button>
    </div>
{/if}

{#if !loaded}
    <div class="flex flex-col items-center justify-center mt-20">
        <p class="text-sm text-black-500">{m.common_loading()}</p>
    </div>
{:else if notifications.length === 0}
    <div class="flex flex-col items-center justify-center mt-20">
        <p class="text-lg text-black-700">{m.notif_empty_title()}</p>
        <p class="text-sm text-black-500 mt-1">{m.notif_empty_body()}</p>
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
