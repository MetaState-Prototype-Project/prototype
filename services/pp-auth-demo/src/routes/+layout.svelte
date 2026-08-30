<script lang="ts">
    import "../app.css";
    import { page } from "$app/state";

    let { data, children } = $props();

    const TABS = [
        { href: "/platforms", label: "Platforms" },
        { href: "/data", label: "Your data" },
        { href: "/acl", label: "Permissions" },
        { href: "/terms", label: "Your terms" },
    ];
</script>

<div class="min-h-screen">
    <header class="border-b border-line bg-surface">
        <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 pt-5">
            <div>
                <p class="eyebrow">Post Platforms Association</p>
                <h1 class="text-lg font-semibold text-ink">
                    What each platform can reach, and why
                </h1>
            </div>
            {#if data.user}
                <form method="POST" action="/api/auth/logout" class="flex items-center gap-3">
                    <span class="mono-block max-w-[18rem] truncate">{data.user.ename}</span>
                    <button class="btn btn-quiet" type="submit">Sign out</button>
                </form>
            {/if}
        </div>

        {#if data.user}
            <nav class="mx-auto flex max-w-6xl gap-1 px-6 pt-5">
                {#each TABS as tab (tab.href)}
                    <a
                        href={tab.href}
                        class="rounded-t-xl border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors"
                        class:border-brand={page.url.pathname === tab.href}
                        class:text-brand={page.url.pathname === tab.href}
                        class:border-transparent={page.url.pathname !== tab.href}
                        class:text-muted={page.url.pathname !== tab.href}
                    >
                        {tab.label}
                    </a>
                {/each}
            </nav>
        {/if}
    </header>

    <main class="mx-auto max-w-6xl px-6 py-8">
        {@render children()}
    </main>
</div>
