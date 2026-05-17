<script lang="ts">
    import "../app.css";
    import { sessionToken, session, logout } from "$lib/session";

    let { children } = $props();
    let loggedIn = $derived($sessionToken !== null);
    let isAdmin = $derived($session?.isAdmin ?? false);
</script>

<div class="min-h-screen">
    <header class="border-b border-gray-200 bg-white">
        <nav class="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
            <a href="/" class="text-lg font-semibold text-gray-900">
                Awareness<span class="text-indigo-600">Service</span>
            </a>
            <div class="flex-1"></div>
            {#if loggedIn}
                <a href="/dashboard" class="text-sm text-gray-600 hover:text-gray-900">Dashboard</a>
                <a href="/apply" class="text-sm text-gray-600 hover:text-gray-900">Apply</a>
                {#if isAdmin}
                    <a href="/admin" class="text-sm text-gray-600 hover:text-gray-900">Admin</a>
                {/if}
                <button
                    class="text-sm text-gray-600 hover:text-gray-900"
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
