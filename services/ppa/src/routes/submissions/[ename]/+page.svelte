<script lang="ts">
    import { enhance } from "$app/forms";
    import { fly } from "svelte/transition";
    import { ACCESS_LEVELS } from "$lib/levels";
    import DomainChips from "$lib/DomainChips.svelte";
    import ReviewThread from "$lib/ReviewThread.svelte";
    import AssessmentMatrix from "$lib/AssessmentMatrix.svelte";
    import IdentityPanel from "$lib/IdentityPanel.svelte";
    import AssessmentResult from "$lib/AssessmentResult.svelte";
    import {
        computeLevel,
        type AccessLevel,
        type DimensionAnswer,
    } from "$lib/levels";
    import PlatformMark from "$lib/PlatformMark.svelte";
    import StatusPill from "$lib/StatusPill.svelte";

    let { data, form } = $props();

    let decision = $state<"granted" | "denied">("granted");
    let level = $state<AccessLevel>("L1");
    // Everything the platform asked for starts approved; the reviewer narrows.
    // Re-seeded per submission so moving between platforms does not carry a
    // previous selection across.
    let answers = $state<DimensionAnswer[]>([]);
    let assessmentOpen = $state(false);
    $effect(() => {
        if (typeof document === "undefined") return;
        document.body.style.overflow = assessmentOpen ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    });
    let overrideReason = $state("");
    let overrideOpen = $state(false);

    let computed = $derived(
        computeLevel(data.framework, answers, data.minimumIal),
    );
    // Following the evidence is the default; the reviewer changes it only
    // deliberately, and then has to say why.
    let followComputed = $state(true);
    $effect(() => {
        if (followComputed && computed.level) level = computed.level;
    });
    let reviewerCount = $derived(
        data.framework.dimensions.filter((d) => d.source === "reviewer").length,
    );
    let answered = $derived(
        answers.filter((a) =>
            data.framework.dimensions.some(
                (d) => d.id === a.id && d.source === "reviewer",
            ),
        ).length,
    );
    let remaining = $derived(reviewerCount - answered);

    let isOverride = $derived(
        decision === "granted" && level !== computed.level,
    );

    let chosen = $state<string[]>([]);
    let seededFor = $state<string | null>(null);
    $effect(() => {
        if (seededFor !== data.submission.ename) {
            seededFor = data.submission.ename;
            chosen = [...data.submission.requestedDomains];
        }
    });

    function toggleDomain(id: string) {
        chosen = chosen.includes(id)
            ? chosen.filter((d) => d !== id)
            : [...chosen, id];
    }
    let submitting = $state(false);
    let copied = $state<string | null>(null);

    async function copy(value: string, label: string) {
        await navigator.clipboard.writeText(value);
        copied = label;
        setTimeout(() => (copied = null), 1500);
    }

    const facts = $derived([
        { label: "Name", value: data.submission.platformName },
        { label: "Category", value: data.submission.category },
        { label: "Version", value: data.submission.version || "—" },
        { label: "Submitted", value: data.submission.submittedAt.slice(0, 10) },
        { label: "Signed by", value: data.submission.submissionProof.statement.signerEName },
    ]);
</script>

{#if assessmentOpen}
    <!-- Held in a drawer so the review page stays readable; the answers live
         in the page, so closing it keeps everything entered so far. -->
    <div class="fixed inset-0 z-50 flex justify-end">
        <button
            type="button"
            class="absolute inset-0 bg-ink/40"
            aria-label="Close assessment"
            onclick={() => (assessmentOpen = false)}
        ></button>

        <!-- Slides in from the right edge, so where it came from is obvious;
             without the transition a panel simply appearing mid-screen reads as
             a floating dialog rather than a drawer. -->
        <div
            class="relative flex h-full w-full max-w-3xl flex-col border-l border-line bg-canvas shadow-lift"
            transition:fly={{ x: 480, duration: 200 }}
        >
            <header class="flex items-center gap-4 border-b border-line bg-surface px-6 py-4">
                <div class="min-w-0 flex-1">
                    <h2 class="text-lg font-semibold text-ink">Assessment</h2>
                    <p class="truncate text-xs text-muted">
                        {data.submission.displayName} v{data.submission.version}
                    </p>
                </div>
                <button
                    type="button"
                    class="btn btn-quiet !px-4 !py-2"
                    onclick={() => (assessmentOpen = false)}
                >
                    Done
                </button>
            </header>

            <div class="flex-1 space-y-6 overflow-y-auto px-6 py-6">
                <IdentityPanel
                    actors={data.actors}
                    minimumIal={data.minimumIal}
                    required={decision === "granted"
                        ? data.framework.identityFloor[level]
                        : null}
                />
                <AssessmentMatrix
                    framework={data.framework}
                    derivedAnswers={data.derivedAnswers}
                    minimumIal={data.minimumIal}
                    bind:answers
                />

                <AssessmentResult
                    framework={data.framework}
                    result={computed}
                    minimumIal={data.minimumIal}
                />

                <section class="card p-6">
                    <h2 class="text-sm font-semibold text-ink">Issue a decision</h2>
                    <p class="mt-1 text-xs text-muted">
                        Signed and published, so anyone can confirm it came from
                        the association.
                    </p>

        {#if form?.message}
            <p
                class="mt-4 rounded-2xl bg-negative-wash px-4 py-3 text-sm text-negative"
                role="alert"
            >
                {form.message}
            </p>
        {/if}

        <form
            method="POST"
            action="?/decide"
            class="mt-5 space-y-5"
            use:enhance={() => {
                submitting = true;
                return async ({ update }) => {
                    await update();
                    submitting = false;
                };
            }}
        >
            <!-- Segmented control: the outcome is a binary choice. -->
            <div class="grid grid-cols-2 gap-1 rounded-full bg-canvas p-1">
                {#each [["granted", "Grant"], ["denied", "Deny"]] as [value, label] (value)}
                    <label
                        class="cursor-pointer rounded-full py-2 text-center text-sm font-medium transition-colors
                            {decision === value
                            ? 'bg-surface text-ink shadow-soft'
                            : 'text-muted hover:text-ink'}"
                    >
                        <input
                            type="radio"
                            name="decision"
                            {value}
                            bind:group={decision}
                            class="sr-only"
                        />
                        {label}
                    </label>
                {/each}
            </div>

            {#if decision === "granted"}
                <div>
                    <p class="text-xs text-faint">Level to award</p>
                    <p class="mt-1 flex items-baseline gap-2">
                        <span class="text-2xl font-semibold text-ink">{level}</span>
                        {#if isOverride}
                            <span class="text-xs text-caution">
                                overriding {computed.level ?? "no level"}
                            </span>
                        {:else}
                            <span class="text-xs text-muted">as calculated</span>
                        {/if}
                    </p>
                    <input type="hidden" name="level" value={level} />
                </div>

                <!-- Overriding stays available but deliberate: closed unless the
                     reviewer goes looking for it. -->
                <details class="rounded-2xl border border-line px-4 py-3">
                    <summary class="cursor-pointer text-xs text-muted select-none hover:text-ink">
                        Award a different level
                    </summary>

                    <div class="mt-3 grid grid-cols-6 gap-1.5">
                        {#each ACCESS_LEVELS as option (option)}
                            <label
                                class="cursor-pointer rounded-xl border py-2 text-center text-sm font-semibold transition-colors
                                    {level === option
                                    ? 'border-brand bg-brand-wash text-brand'
                                    : 'border-line text-muted hover:border-brand-tint'}"
                            >
                                <input
                                    type="radio"
                                    name="levelChoice"
                                    value={option}
                                    checked={level === option}
                                    onchange={() => {
                                        level = option;
                                        followComputed = false;
                                    }}
                                    class="sr-only"
                                />
                                {option}
                            </label>
                        {/each}
                    </div>

                    {#if isOverride}
                        <button
                            type="button"
                            class="mt-2 text-xs text-brand hover:underline"
                            onclick={() => {
                                followComputed = true;
                                if (computed.level) level = computed.level;
                            }}
                        >
                            Back to the calculated level
                        </button>
                    {/if}
                </details>
            {/if}

            {#if decision === "granted"}
                <fieldset>
                    <legend class="text-xs text-faint">Areas requested</legend>
                    <p class="mt-1 text-xs text-muted">
                        {data.submission.requestedDomains.length > 0
                            ? "Derived from the record types this platform declares it uses. Deselect anything you are not approving."
                            : "This platform has not declared what it works with, so there is nothing to approve."}
                    </p>
                    <div class="mt-2 flex flex-wrap gap-1.5">
                        {#each data.requestedDomains as domain (domain.id)}
                            <label
                                title={domain.description}
                                class="cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors
                                    {chosen.includes(domain.id)
                                    ? 'border-brand bg-brand-wash text-brand'
                                    : 'border-line text-muted hover:border-brand-tint'}"
                            >
                                <input
                                    type="checkbox"
                                    name="domains"
                                    value={domain.id}
                                    checked={chosen.includes(domain.id)}
                                    onchange={() => toggleDomain(domain.id)}
                                    class="sr-only"
                                />
                                {domain.label}
                            </label>
                        {/each}
                    </div>
                </fieldset>
            {/if}

            {#if isOverride}
                <div>
                    <label for="overrideReason" class="text-xs text-caution">
                        Why {level} rather than {computed.level ?? "no level"}?
                    </label>
                    <textarea
                        id="overrideReason"
                        name="overrideReason"
                        rows="3"
                        bind:value={overrideReason}
                        placeholder="Recorded on the certificate beside the computed level…"
                        class="field mt-2 resize-y"
                    ></textarea>
                </div>
            {/if}

            <div>
                <label for="statement" class="text-xs text-faint">
                    Reasons for your decision
                </label>
                <textarea
                    id="statement"
                    name="statement"
                    rows="5"
                    required
                    placeholder="Published alongside your decision, so explain the reasoning…"
                    class="field mt-2 resize-y"
                ></textarea>
            </div>

            {#each answers as answer (answer.id)}
                <input
                    type="hidden"
                    name={`dimension:${answer.id}`}
                    value={answer.option}
                />
            {/each}

            <button
                type="submit"
                disabled={submitting}
                class="btn btn-primary w-full"
            >
                {submitting ? "Signing…" : "Sign and issue"}
            </button>
        </form>
                </section>
            </div>
        </div>
    </div>
{/if}

<a
    href="/"
    class="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
            d="m15 6-6 6 6 6"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
        />
    </svg>
    Submissions
</a>

<header class="mt-5 flex flex-wrap items-start gap-5">
    <PlatformMark
        logoUrl={data.submission.logoUrl}
        name={data.submission.displayName}
        size={56}
    />
    <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-3">
            <h1 class="text-3xl font-semibold text-ink">{data.submission.displayName}</h1>
            {#if data.submission.version}
                <span class="pill bg-canvas text-muted">v{data.submission.version}</span>
            {/if}
            <StatusPill
                decision={data.currentDecision?.decision ?? null}
                level={data.currentDecision?.level ?? null}
            />
        </div>
        <p class="mono-block mt-1.5">{data.submission.ename}</p>
    </div>
</header>

<div class="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_23rem]">
    <!-- Left: the application under review -->
    <div class="space-y-6">
        <section class="card p-6">
            <h2 class="text-sm font-semibold text-ink">Application</h2>

            <dl class="mt-5 grid grid-cols-2 gap-x-8 gap-y-5">
                {#each facts as fact (fact.label)}
                    <div>
                        <dt class="text-xs text-faint">{fact.label}</dt>
                        <dd class="mt-1 text-sm font-medium text-ink">{fact.value}</dd>
                    </div>
                {/each}
                <div class="col-span-2">
                    <dt class="text-xs text-faint">Repository</dt>
                    <dd class="mt-1 text-sm break-all">
                        {#if data.repositoryUrl}
                            <a
                                href={data.repositoryUrl}
                                target="_blank"
                                rel="noreferrer"
                                class="font-medium text-brand hover:underline"
                            >
                                {data.submission.submissionProof.statement.repository}
                            </a>
                        {:else}
                            <span class="font-medium text-ink">
                                {data.submission.submissionProof.statement.repository}
                            </span>
                        {/if}
                    </dd>
                </div>
                <div class="col-span-2">
                    <dt class="text-xs text-faint">URL</dt>
                    <dd class="mt-1 text-sm">
                        {#if data.submission.url}
                            <a
                                href={data.submission.url}
                                target="_blank"
                                rel="noreferrer"
                                class="font-medium text-brand hover:underline"
                            >
                                {data.submission.url}
                            </a>
                        {:else}
                            <span class="text-muted">—</span>
                        {/if}
                    </dd>
                </div>
            </dl>

            {#if data.submission.description}
                <div class="mt-6 border-t border-line pt-5">
                    <dt class="text-xs text-faint">Description</dt>
                    <p class="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-body">
                        {data.submission.description}
                    </p>
                </div>
            {/if}

            <div class="mt-6 rounded-2xl bg-positive-wash px-4 py-3">
                <p class="text-sm font-semibold text-positive">Owner/admin signature verified</p>
                <p class="mt-1 text-xs text-positive/80">
                    This exact release statement and its Registry-backed wallet proof were read from
                    the platform's eVault.
                </p>
            </div>

            <details class="group mt-6 border-t border-line pt-4">
                <summary
                    class="cursor-pointer text-xs font-medium text-muted select-none hover:text-ink"
                >
                    All submitted details
                </summary>
                <pre class="mono-block mt-3 overflow-x-auto rounded-2xl bg-canvas p-4">{JSON.stringify(
                        data.submission.raw,
                        null,
                        2,
                    )}</pre>
            </details>
        </section>

        <ReviewThread
            history={data.history}
            submission={data.submission}
            domains={data.domains}
            submissionHistory={data.submission.submissionHistory}
            pendingResponse={data.submission.submissionProof.statement.responseToDecision ?? null}
            pendingAt={data.submission.submissionProof.statement.issuedAt ?? null}
        />

        <section class="card p-6">
            <div class="flex items-baseline justify-between gap-4">
                <h2 class="text-sm font-semibold text-ink">Authors</h2>
                {#if !data.messengerConfigured}
                    <p class="text-xs text-faint">Messaging unavailable</p>
                {/if}
            </div>

            <ul class="mt-5 space-y-3">
                {#each data.authors as author (author.ename)}
                    <li
                        class="flex items-center gap-4 rounded-2xl border border-line px-4 py-3.5"
                    >
                        {#if author.avatarUrl}
                            <img
                                src={author.avatarUrl}
                                alt=""
                                class="size-10 shrink-0 rounded-full object-cover"
                            />
                        {:else}
                            <div
                                class="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-wash text-sm font-semibold text-brand"
                            >
                                {author.displayName.slice(0, 1).toUpperCase()}
                            </div>
                        {/if}

                        <div class="min-w-0 flex-1">
                            <p class="truncate font-medium text-ink">{author.displayName}</p>
                            <p class="mono-block truncate">{author.ename}</p>
                            {#if author.bio}
                                <p class="mt-1 truncate text-sm text-muted">{author.bio}</p>
                            {/if}
                        </div>

                        {#if author.messageUrl}
                            <a
                                href={author.messageUrl}
                                target="_blank"
                                rel="noreferrer"
                                class="btn btn-quiet !px-4 !py-2"
                            >
                                {author.messageLabel ?? "Message"}
                            </a>
                        {:else}
                            <button
                                type="button"
                                class="btn btn-quiet !px-4 !py-2"
                                onclick={() => copy(author.ename, author.ename)}
                            >
                                {copied === author.ename ? "Copied" : "Copy eName"}
                            </button>
                        {/if}
                    </li>
                {/each}
            </ul>
        </section>
    </div>

    <!-- Right: the decision, kept in view while reading the application -->
    <aside class="lg:sticky lg:top-24">
        {#if form?.issued}
            <section class="card overflow-hidden">
                <div class="bg-positive-wash px-6 py-5">
                    <p class="text-sm font-semibold text-positive">
                        {form.issued.decision === "granted"
                            ? `${form.issued.level} granted for v${form.issued.platformVersion}`
                            : `Access denied for v${form.issued.platformVersion}`}
                    </p>
                    {#if form.issued.domains.length > 0}
                        <div class="mt-2">
                            <DomainChips ids={form.issued.domains} domains={data.domains} />
                        </div>
                    {/if}
                    <p class="mt-1 text-xs text-positive/80">
                        Published to the association's public record.
                    </p>
                </div>
                <div class="p-6">
                    <p class="text-xs text-faint">Verification record</p>
                    <pre class="mono-block mt-2 max-h-40 overflow-auto rounded-2xl bg-canvas p-3">{form
                            .issued.jws}</pre>
                    <button
                        type="button"
                        class="btn btn-quiet mt-3 w-full"
                        onclick={() => copy(form.issued.jws, "jws")}
                    >
                        {copied === "jws" ? "Copied" : "Copy record"}
                    </button>
                    <a href="/" class="btn btn-primary mt-2 w-full">Back to queue</a>
                </div>
            </section>
        {:else}
            <section class="card p-6">
                <h2 class="text-sm font-semibold text-ink">Decision</h2>
                <p class="mt-1 text-xs text-muted">
                    Work through the assessment, then award a level. Everything
                    you record is signed and published.
                </p>

                <button
                    type="button"
                    class="mt-4 w-full rounded-2xl px-4 py-3 text-left transition-colors {computed.level
                        ? 'bg-brand-wash hover:bg-brand-tint/60'
                        : 'bg-canvas hover:bg-line/60'}"
                    onclick={() => (assessmentOpen = true)}
                >
                    <span class="flex items-center justify-between gap-3">
                        <span>
                            <span class="block text-xs {computed.level ? 'text-brand' : 'text-muted'}">
                                {answered === 0
                                    ? "Assessment"
                                    : "Assessment supports"}
                            </span>
                            <span class="block text-lg font-semibold {computed.level ? 'text-brand' : 'text-ink'}">
                                {answered === 0
                                    ? "Begin assessment"
                                    : (computed.level ?? "no level yet")}
                            </span>
                        </span>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="shrink-0 text-faint">
                            <path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                    </span>
                    {#if answered > 0 && remaining > 0}
                        <span class="mt-1 block text-xs text-muted">
                            {remaining} of {reviewerCount} judgements still to make
                        </span>
                    {:else if answered > 0}
                        <span class="mt-1 block text-xs text-muted">
                            All judgements made — reopen to revise
                        </span>
                    {/if}
                </button>

            </section>
        {/if}
    </aside>
</div>
