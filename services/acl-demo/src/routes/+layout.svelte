<script lang="ts">
    import "../app.css";
    let { children } = $props();
</script>

<div class="min-h-screen">
    <header class="border-b border-line bg-surface">
        <div class="mx-auto max-w-5xl px-6 py-5">
            <p class="eyebrow">Access control</p>
            <h1 class="text-lg font-semibold text-ink">
                Watch a record decide who may touch it
            </h1>
        </div>
    </header>

    <main class="mx-auto max-w-5xl px-6 py-8">
        {@render children()}
    </main>
</div>
