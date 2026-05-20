<script lang="ts">
import * as Button from "$lib/ui/Button";
import { EditIcon, GearIcon, MessageIcon } from "$lib/ui/icons";

interface IGreetingProps {
    greeting: string;
    name: string;
    notificationCount: number;
    onedit?: () => void;
    /** When true, hide the edit-name + notifications + settings affordances
     *  so the welcome tour can't be derailed by a stray tap. */
    tourActive?: boolean;
}

const {
    greeting,
    name,
    notificationCount,
    onedit,
    tourActive = false,
}: IGreetingProps = $props();
</script>

<header class="flex items-start justify-between pt-2">
    <div>
        <h1 class="text-[40px] font-bold font-condensed text-black-300 leading-none">
            {greeting}
        </h1>
        <div class="flex items-center gap-2">
            <h2 class="text-[40px] font-bold font-condensed text-black leading-none">
                {name}
            </h2>
            {#if !tourActive}
                <button
                    type="button"
                    aria-label="Edit name"
                    onclick={onedit}
                    class="text-black bg-black-100 p-2 rounded-full active:opacity-60"
                >
                    <EditIcon size={20} />
                </button>
            {/if}
        </div>
    </div>

    {#if !tourActive}
        <div class="flex items-center gap-4 shrink-0 mt-2">
            <Button.Nav
                href="/notifications"
                class="relative"
                aria-label={notificationCount > 0
                    ? `Notifications (${notificationCount} unread)`
                    : "Notifications"}
            >
                <MessageIcon size={24} />
                {#if notificationCount > 0}
                    <span
                        class="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-4.5 h-4.5 flex items-center justify-center px-1"
                    >
                        {notificationCount > 99 ? "99+" : notificationCount}
                    </span>
                {/if}
            </Button.Nav>
            <Button.Nav href="/settings" aria-label="Settings">
                <GearIcon size={24} />
            </Button.Nav>
        </div>
    {/if}
</header>
