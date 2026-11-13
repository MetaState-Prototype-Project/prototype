<script lang="ts">
    import "../app.css";
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import Logo from "$lib/Logo.svelte";

    let { data, children } = $props();

    const nav = [
        { href: "/", label: "Submissions" },
        { href: "/decisions", label: "Decisions" },
    ];

    function isCurrent(href: string): boolean {
        return href === "/"
            ? page.url.pathname === "/" || page.url.pathname.startsWith("/submissions")
            : page.url.pathname.startsWith(href);
    }

    async function logout() {
        await fetch("/api/auth/logout", { method: "POST" });
        await goto("/login", { invalidateAll: true });
    }
</script>

<div class="min-h-screen">
    {#if data.user}
        <header class="sticky top-0 z-10 border-b border-line bg-surface/85 backdrop-blur">
            <div class="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
                <a href="/" class="flex items-center gap-2.5">
                    <Logo />
                    <span class="text-[0.9375rem] leading-tight font-semibold text-ink">
                        Post Platforms
                        <span class="block text-[0.6875rem] font-medium tracking-[0.14em] text-faint uppercase">
                            Association
                        </span>
                    </span>
                </a>

                <nav class="flex items-center gap-1">
                    {#each nav as item (item.href)}
                        <a
                            href={item.href}
                            class="rounded-full px-3.5 py-2 text-sm font-medium transition-colors
                                {isCurrent(item.href)
                                ? 'bg-brand-wash text-brand'
                                : 'text-muted hover:text-ink'}"
                        >
                            {item.label}
                        </a>
                    {/each}
                </nav>

                <div class="flex-1"></div>

                <div class="flex items-center gap-3">
                    <span
                        class="hidden max-w-[13rem] truncate font-mono text-xs text-faint sm:block"
                        title={data.user.ename}
                    >
                        {data.user.ename}
                    </span>
                    <button class="btn btn-quiet !px-4 !py-2" onclick={logout}>Sign out</button>
                </div>
            </div>
        </header>
    {/if}

    <main class="mx-auto max-w-6xl px-6 {data.user ? 'py-10' : ''}">
        {@render children()}
    </main>
</div>
