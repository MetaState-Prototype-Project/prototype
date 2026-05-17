<script lang="ts">
    import "../app.css";
    import { sessionToken, session, logout } from "$lib/session";

    let { children } = $props();
    let loggedIn = $derived($sessionToken !== null);
    let isAdmin = $derived($session?.isAdmin ?? false);
</script>

<div class="min-h-screen">
    <header class="border-b border-white/10 bg-[#0e1118]">
        <nav class="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
            <a href="/" class="text-lg font-semibold text-white">
                Awareness<span class="text-indigo-400">Service</span>
            </a>
            <div class="flex-1"></div>
            {#if loggedIn}
                <a href="/dashboard" class="text-sm text-gray-400 hover:text-white">Dashboard</a>
                <a href="/apply" class="text-sm text-gray-400 hover:text-white">Apply</a>
                {#if isAdmin}
                    <a href="/admin" class="text-sm text-gray-400 hover:text-white">Admin</a>
                {/if}
                <button
                    class="text-sm text-gray-400 hover:text-white"
                    onclick={logout}
                >
                    Log out
                </button>
            {/if}
        </nav>
    </header>
    <main class="mx-auto max-w-5xl px-6 py-8">
        {@render children()}
    </main>
</div>
