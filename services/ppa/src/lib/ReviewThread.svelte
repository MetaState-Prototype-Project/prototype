<script lang="ts">
    import DomainChips from "$lib/DomainChips.svelte";
    import type { Domain } from "$lib/types";

    interface Turn {
        side: "applicant" | "association";
        at: string;
        version: string;
        body: string;
        who: string;
        decision?: "granted" | "denied";
        level?: string | null;
        domains?: string[];
    }

    let {
        history = [],
        submission,
        domains = [],
        pendingResponse = null,
        pendingAt = null,
    }: {
        history?: any[];
        submission: { version: string; displayName: string; ename: string };
        domains?: Domain[];
        pendingResponse?: string | null;
        pendingAt?: string | null;
    } = $props();

    /**
     * One exchange, oldest first. Each decision carries the applicant's words
     * as they stood when it was taken, so the earlier rounds survive even
     * though a platform profile is overwritten on every resubmission.
     */
    let turns = $derived.by(() => {
        const out: Turn[] = [];
        for (const d of history) {
            if (d.applicantResponse) {
                out.push({
                    side: "applicant",
                    at: d.applicantSubmittedAt ?? d.createdAt,
                    version: d.platformVersion,
                    body: d.applicantResponse,
                    who: submission.displayName,
                });
            }
            out.push({
                side: "association",
                at: d.createdAt,
                version: d.platformVersion,
                body: d.statement,
                who: d.reviewedByEName,
                decision: d.decision,
                level: d.level,
                domains: d.domains ?? [],
            });
        }
        // The turn currently awaiting a reply is not in any decision yet.
        if (pendingResponse) {
            out.push({
                side: "applicant",
                at: pendingAt ?? new Date().toISOString(),
                version: submission.version,
                body: pendingResponse,
                who: submission.displayName,
            });
        }
        // Sort rather than trusting insertion order: the pending turn is
        // appended last but was written before the reply it precedes. The sort
        // is stable, so a decision and the response it captured keep their
        // applicant-then-association order when the timestamps match.
        return out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    });
</script>

{#if turns.length > 0}
    <section class="card p-6">
        <h2 class="text-sm font-semibold text-ink">Review history</h2>

        <ol class="mt-5 space-y-4">
            {#each turns as turn, i (turn.side + turn.at + i)}
                <li class="flex gap-3 {turn.side === 'association' ? 'flex-row-reverse' : ''}">
                    <!-- Thread rail: the exchange reads as one column of turns. -->
                    <div class="flex w-9 shrink-0 flex-col items-center">
                        <span
                            class="flex size-9 items-center justify-center rounded-full text-xs font-semibold
                                {turn.side === 'association'
                                ? 'bg-brand-tint text-brand-strong'
                                : 'bg-canvas text-muted'}"
                        >
                            {turn.side === "association" ? "PPA" : turn.who.slice(0, 1).toUpperCase()}
                        </span>
                        {#if i < turns.length - 1}
                            <span class="mt-1 w-px flex-1 bg-line"></span>
                        {/if}
                    </div>

                    <div
                        class="min-w-0 flex-1 rounded-2xl px-4 py-3 {turn.side === 'association'
                            ? 'bg-brand-wash'
                            : 'border border-line bg-surface'}"
                    >
                        <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span class="text-xs font-semibold text-ink">
                                {turn.side === "association" ? "Association" : turn.who}
                            </span>
                            <span class="text-xs text-faint">v{turn.version}</span>
                            <span class="text-xs text-faint">{turn.at.slice(0, 16).replace("T", " ")}</span>
                            {#if turn.decision}
                                <span
                                    class="pill {turn.decision === 'granted'
                                        ? 'bg-positive-wash text-positive'
                                        : 'bg-negative-wash text-negative'}"
                                >
                                    {turn.decision === "granted" ? (turn.level ?? "Granted") : "Denied"}
                                </span>
                            {/if}
                        </div>

                        <p class="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-body">
                            {turn.body}
                        </p>

                        {#if turn.domains && turn.domains.length > 0}
                            <div class="mt-2">
                                <DomainChips ids={turn.domains} {domains} />
                            </div>
                        {/if}
                    </div>
                </li>
            {/each}
        </ol>
    </section>
{/if}
