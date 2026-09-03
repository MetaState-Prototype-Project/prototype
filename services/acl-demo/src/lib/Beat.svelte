<script lang="ts">
    /**
     * One beat, with the wire on show.
     *
     * The narration says what is being attempted. Everything that decides the
     * outcome — the stored policy, the query, the variables, the response — is
     * printed verbatim, because a demonstration that asks you to take its word
     * for the interesting part is not demonstrating anything.
     */

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

    let { result, labels }: { result: Result; labels: Record<string, string> } = $props();

    const who = (ename: string) => `${labels[ename] ?? "someone not in the cast"} · ${ename}`;
    const membershipOnly = $derived(
        result.kind === "act" && result.membersAfter !== null && result.policyAfter === null,
    );
</script>

<section class="card overflow-hidden">
    <header class="flex flex-wrap items-start justify-between gap-3 border-b border-line p-6">
        <p class="max-w-2xl text-base font-semibold text-ink">{result.say}</p>
        <span
            class="pill text-sm"
            class:bg-positive-wash={result.verdict === "allowed"}
            class:text-positive={result.verdict === "allowed"}
            class:bg-negative-wash={result.verdict === "refused" || result.verdict === "failed"}
            class:text-negative={result.verdict === "refused" || result.verdict === "failed"}
            class:bg-brand-wash={result.verdict === "done"}
            class:text-brand={result.verdict === "done"}
        >
            {#if result.verdict === "allowed"}allowed
            {:else if result.verdict === "refused"}refused
            {:else if result.verdict === "done"}written
            {:else}could not be written{/if}
        </span>
    </header>

    <div class="divide-y divide-line">
        {#if result.policyBefore}
            <div class="p-6">
                <p class="text-xs font-semibold tracking-wide text-faint uppercase">
                    {result.policyAfter
                        ? "the policy on the note, before"
                        : membershipOnly
                          ? "the policy on the note — unchanged by this"
                          : "the policy on the note"}
                </p>
                <pre class="mono-block mt-2 overflow-x-auto rounded-xl bg-canvas p-4">{result.policyBefore}</pre>
            </div>
        {/if}

        {#if result.policyAfter}
            <div class="p-6">
                <p class="text-xs font-semibold tracking-wide text-faint uppercase">
                    the policy on the note, after
                </p>
                <pre class="mono-block mt-2 overflow-x-auto rounded-xl bg-brand-wash p-4">{result.policyAfter}</pre>
                {#if result.record}
                    <p class="mono-block mt-3">the note is now {result.record}</p>
                {/if}
            </div>
        {/if}

        {#if result.membersBefore}
            <div class="p-6">
                <p class="text-xs font-semibold tracking-wide text-faint uppercase">
                    the Reading Circle resolves to{#if result.membersAfter} — before{/if}
                </p>
                <ul class="mt-2 space-y-1">
                    {#each result.membersBefore as m (m)}
                        <li class="mono-block">{who(m)}</li>
                    {/each}
                </ul>
                {#if result.membersAfter}
                    <p class="mt-4 text-xs font-semibold tracking-wide text-faint uppercase">
                        and after
                    </p>
                    <ul class="mt-2 space-y-1">
                        {#each result.membersAfter as m (m)}
                            <li class="mono-block">{who(m)}</li>
                        {/each}
                    </ul>
                {/if}
            </div>
        {/if}

        {#if result.kind === "ask"}
            <div class="p-6">
                <p class="text-xs font-semibold tracking-wide text-faint uppercase">
                    the request — {result.who} · {result.verb}
                </p>
                <pre class="mono-block mt-2 overflow-x-auto rounded-xl bg-canvas p-4">POST {result.endpoint}
{#each Object.entries(result.headers ?? {}) as [name, value] (name)}{name}: {value}
{/each}
{result.query}
variables {result.variables}</pre>
            </div>

            <div class="p-6">
                <p class="text-xs font-semibold tracking-wide text-faint uppercase">
                    what came back
                </p>
                <pre class="mono-block mt-2 max-h-96 overflow-auto rounded-xl bg-canvas p-4">{result.response}</pre>
            </div>
        {:else if result.detail}
            <div class="p-6"><p class="mono-block">{result.detail}</p></div>
        {/if}

        <div class="bg-canvas p-6">
            <p class="max-w-3xl border-l-2 border-brand pl-4 text-sm text-body">{result.then}</p>
        </div>
    </div>
</section>
