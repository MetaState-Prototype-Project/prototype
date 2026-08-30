<script lang="ts">
    import "../app.css";
    let { children } = $props();
</script>

<div class="min-h-screen">
    <header class="border-b border-line bg-surface/80 backdrop-blur">
        <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <div>
                <p class="eyebrow">Post Platforms Association</p>
                <h1 class="text-lg font-semibold text-ink">
                    How a platform proves what it is
                </h1>
            </div>
            <a
                class="btn btn-quiet"
                href="https://github.com/MetaState-Prototype-Project/prototype"
                rel="noreferrer"
            >
                Documentation
            </a>
        </div>
    </header>

    <main class="mx-auto max-w-6xl px-6 py-10">
        {@render children()}
    </main>
</div>
