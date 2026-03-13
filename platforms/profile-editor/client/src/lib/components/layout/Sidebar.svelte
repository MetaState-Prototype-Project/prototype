<script lang="ts">
    import { page } from "$app/stores";
    import { toggleMode, mode } from "mode-watcher";
    import { Button } from "@metastate-foundation/ui/button";
    import { Separator } from "@metastate-foundation/ui/separator";

    const navItems = [
        {
            href: "/profile",
            label: "My Profile",
            icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
        },
        {
            href: "/discover",
            label: "Discover",
            icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
        },
        {
            href: "/settings",
            label: "Settings",
            icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
        },
    ];

    const sunIcon =
        "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z";
    const moonIcon =
        "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z";
</script>

<aside class="hidden w-64 shrink-0 border-r border-border bg-card lg:block">
    <div class="flex h-full flex-col">
        <div class="flex h-16 items-center gap-3 px-6">
            <img
                src="/img/logo.png"
                alt="Profile Editor Logo"
                class="h-10 w-10"
            />
            <span class="text-lg font-semibold text-foreground"
                >Profile Editor</span
            >
        </div>

        <Separator />

        <nav class="flex-1 space-y-1 p-3">
            {#each navItems as item}
                <Button
                    variant={$page.url.pathname === item.href
                        ? "secondary"
                        : "ghost"}
                    href={item.href}
                    class="w-full justify-start gap-3"
                >
                    <svg
                        class="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d={item.icon}
                        />
                    </svg>
                    {item.label}
                </Button>
            {/each}
        </nav>

        <Separator />

        <div class="p-3">
            <Button
                variant="ghost"
                class="w-full justify-start gap-3"
                onclick={toggleMode}
            >
                <svg
                    class="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d={mode.current === "dark" ? sunIcon : moonIcon}
                    />
                </svg>
                {mode.current === "dark" ? "Light Mode" : "Dark Mode"}
            </Button>
        </div>
    </div>
</aside>
