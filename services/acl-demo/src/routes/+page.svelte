<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import Beat from "$lib/Beat.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    interface Result {
        index: number;
        kind: "ask" | "act";
        say: string;
        then: string;
        who: string | null;
        verb: string | null;
        policyBefore: string | null;
        policyAfter: string | null;
        membersBefore: string[] | null;
        membersAfter: string[] | null;
        endpoint: string | null;
        headers: Record<string, string> | null;
        query: string | null;
        variables: string | null;
        response: string | null;
        verdict: "allowed" | "refused" | "done" | "failed";
        detail: string | null;
        record: string | null;
    }

    /** A beat that has happened: either narration, or something that ran. */
    type Shown = { index: number } & (
        | { sort: "narration" }
        | { sort: "result"; result: Result }
    );

    let shown = $state<Shown[]>([]);
    let busy = $state(false);
    let error = $state<string | null>(null);

    const at = $derived(shown.length);
    const finished = $derived(at >= data.beats.length);
    const upNext = $derived(finished ? null : data.beats[at]);

    /** How far through the chapters we are, for the bar at the top. */
    const chapters = $derived(
        data.beats
            .map((beat, index) => ({ beat, index }))
            .filter((entry) => entry.beat.kind === "chapter"),
    );

    async function advance() {
        if (finished || busy) return;
        const beat = data.beats[at];

        // Narration needs no eVault, so it appears the moment it is asked for.
        if (beat.kind === "cast" || beat.kind === "chapter") {
            shown = [...shown, { index: at, sort: "narration" }];
            return;
        }

        busy = true;
        error = null;
        try {
            const res = await fetch("/api/beat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ index: at }),
            });
            const body = await res.json();
            if (!body.ok) error = body.error;
            else shown = [...shown, { index: at, sort: "result", result: body.result }];
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
        } finally {
            busy = false;
        }
    }

    async function startOver() {
        busy = true;
        error = null;
        try {
            const res = await fetch("/api/seed", { method: "POST" });
            const body = await res.json();
            if (!body.ok) error = body.error;
            else {
                shown = [];
                await invalidateAll();
            }
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
        } finally {
            busy = false;
        }
    }
</script>

<svelte:window
    onkeydown={(e) => {
        if (e.key === "ArrowRight" || e.key === " ") {
            e.preventDefault();
            advance();
        }
    }}
/>

{#if !data.ready}
    <div class="space-y-6">
        <section class="card p-6">
            <p class="eyebrow">Before we start</p>
            <h2 class="mt-1 text-2xl font-semibold text-ink">Nothing exists yet</h2>
            <div class="mt-3 max-w-3xl space-y-3 text-sm text-body">
                <p>
                    This walkthrough needs a cast, and the cast needs to be real: eight
                    eVaults, provisioned against the live network one at a time, because
                    each one needs its own entropy token from the registry. Give it a
                    minute.
                </p>
                <p>
                    Nothing is written into your own eVault. Everything you are about to
                    see lives in a vault provisioned for the purpose.
                </p>
            </div>
            <button class="btn btn-primary mt-4" onclick={startOver} disabled={busy}>
                {busy ? "Provisioning…" : "Set the stage"}
            </button>
            {#if error}
                <p class="mt-3 text-sm text-negative">{error}</p>
            {/if}
        </section>
    </div>
{:else}
    <div class="space-y-6">
        <section class="card p-6">
            <p class="eyebrow">Access control</p>
            <h2 class="mt-1 text-2xl font-semibold text-ink">
                One note, four policies, and everybody who wants it
            </h2>
            <div class="mt-3 max-w-3xl space-y-3 text-sm text-body">
                <p>
                    An eVault record carries its own rules — who may read it, add to it,
                    change it, delete it. They live inside the record rather than in a
                    table beside it, so they travel with the data when it syncs.
                </p>
                <p>
                    What follows is one continuous run. You meet the cast, then Alice's
                    note has its rules rewritten four times while the same handful of
                    parties keep asking for it. Every request is real and every answer is
                    the eVault's, printed next to the policy that produced it.
                </p>
            </div>
            <p class="mono-block mt-3">Alice's eVault: {data.vault}</p>
        </section>

        <section class="card sticky top-2 z-10 p-4">
            <div class="flex flex-wrap items-center gap-3">
                <button class="btn btn-primary" onclick={advance} disabled={busy || finished}>
                    {#if busy}
                        Running…
                    {:else if finished}
                        That's the whole thing
                    {:else if at === 0}
                        Start →
                    {:else}
                        Next →
                    {/if}
                </button>
                <button class="btn btn-quiet" onclick={startOver} disabled={busy}>
                    Start over
                </button>

                <div class="ml-auto flex items-center gap-1.5">
                    {#each data.beats as _, i (i)}
                        <span
                            class="h-1.5 w-2.5 rounded-full transition-colors"
                            class:bg-brand={i < at}
                            class:bg-brand-tint={i === at}
                            class:bg-line={i > at}
                        ></span>
                    {/each}
                </div>
            </div>

            {#if upNext}
                <p class="mt-3 text-sm text-muted">
                    Up next —
                    {#if upNext.kind === "cast"}
                        meet {upNext.label}
                    {:else if upNext.kind === "chapter"}
                        <span class="font-semibold text-ink">{upNext.title}</span>
                    {:else if upNext.kind === "ask"}
                        {upNext.who} tries to {upNext.verb}
                    {:else}
                        the world changes
                    {/if}
                    · press <kbd class="mono-block">→</kbd> or the button.
                </p>
            {/if}
            {#if error}
                <p class="mt-3 text-sm text-negative">{error}</p>
            {/if}
        </section>

        {#each shown as entry (entry.index)}
            {@const beat = data.beats[entry.index]}
            {#if entry.sort === "narration" && beat.kind === "cast"}
                <section class="card flex flex-wrap items-start gap-6 p-6">
                    <div class="min-w-[10rem]">
                        <p class="eyebrow">{beat.role}</p>
                        <h3 class="mt-1 text-lg font-semibold text-ink">{beat.label}</h3>
                        <p class="mono-block mt-1">{beat.ename}</p>
                    </div>
                    <p class="max-w-2xl flex-1 text-sm text-body">{beat.say}</p>
                </section>
            {:else if entry.sort === "narration" && beat.kind === "chapter"}
                <section class="mt-10 border-t-2 border-brand pt-6">
                    <h3 class="text-2xl font-semibold text-ink">{beat.title}</h3>
                    <p class="mt-2 max-w-3xl text-base text-body">{beat.say}</p>
                </section>
            {:else if entry.sort === "result"}
                <Beat result={entry.result} labels={data.labels} />
            {/if}
        {/each}

        {#if busy}
            {@const pending = data.beats[at]}
            <section class="card animate-pulse border-brand-tint p-6">
                <p class="eyebrow">Running</p>
                <p class="mt-1 text-base font-semibold text-ink">{pending.say}</p>
                <p class="mt-3 text-sm text-muted">
                    {#if pending.kind === "ask"}
                        Asking the eVault, and reading back the policy it decided with.
                    {:else}
                        Writing, and reading back what is stored afterwards.
                    {/if}
                </p>
            </section>
        {/if}

        {#if shown.some((e) => e.sort === "result" && e.result.verdict === "refused")}
            <section class="card p-6">
                <h3 class="text-lg font-semibold text-ink">About that "Unexpected error."</h3>
                <p class="mt-2 max-w-3xl text-sm text-body">
                    That is what a refusal looks like coming back from the eVault, and it
                    is not a fault in this app. The specification says a refused record
                    raises <code class="mono-block">Access denied</code>, but the GraphQL
                    server masks errors it did not raise itself, so the reason does not
                    survive the trip. The paragraph under each beat is therefore this
                    app's reading of the policy printed above it, not the eVault's own
                    account of its decision.
                </p>
            </section>
        {/if}

        {#if finished}
            <section class="card p-6">
                <h3 class="text-lg font-semibold text-ink">That's the whole thing</h3>
                <p class="mt-2 max-w-3xl text-sm text-body">
                    Four policies, one note, and every answer above decided by the JSON
                    printed beside it. <button
                        class="font-semibold text-brand hover:underline"
                        onclick={startOver}>Start over</button
                    > to run it again from a clean note.
                </p>
            </section>
        {/if}
    </div>
{/if}
