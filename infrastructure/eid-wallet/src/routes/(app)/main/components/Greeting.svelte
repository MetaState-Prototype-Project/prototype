<script lang="ts">
import * as Button from "$lib/ui/Button";
import {
    ChatNotificationIcon,
    Edit02Icon,
    Settings02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";

interface IGreetingProps {
    greeting: string;
    name: string;
    notificationCount: number;
    onedit?: () => void;
}

const { greeting, name, notificationCount, onedit }: IGreetingProps = $props();
</script>

<header class="flex items-start justify-between pt-2">
    <div>
        <h1 class="text-3xl font-light text-black-500 leading-tight">
            {greeting}
        </h1>
        <div class="flex items-center gap-2 mt-1">
            <h2 class="text-3xl font-bold text-black-900 leading-tight">
                {name}
            </h2>
            <button
                type="button"
                aria-label="Edit name"
                onclick={onedit}
                class="text-black-500 active:opacity-60"
            >
                <HugeiconsIcon icon={Edit02Icon} size={20} strokeWidth={2} />
            </button>
        </div>
    </div>

    <div class="flex items-center gap-2 shrink-0">
        <Button.Nav
            href="/notifications"
            class="relative"
            aria-label={notificationCount > 0
                ? `Notifications (${notificationCount} unread)`
                : "Notifications"}
        >
            <HugeiconsIcon
                size={26}
                strokeWidth={2}
                icon={ChatNotificationIcon}
            />
            {#if notificationCount > 0}
                <span
                    class="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-4.5 h-4.5 flex items-center justify-center px-1"
                >
                    {notificationCount > 99 ? "99+" : notificationCount}
                </span>
            {/if}
        </Button.Nav>
        <Button.Nav href="/settings" aria-label="Settings">
            <HugeiconsIcon
                size={28}
                strokeWidth={2}
                icon={Settings02Icon}
            />
        </Button.Nav>
    </div>
</header>
