<script lang="ts">
	import type {
		RateLimitConfig,
		RateLimitKind,
		RateLimitMode,
		RateLimitRule,
		RateLimitUsage,
		UsageRow
	} from '$lib/server/rate-limits';
	import { ButtonAction } from '$lib/ui';
	import { onDestroy, onMount } from 'svelte';

	type ToastVariant = 'success' | 'error';
	type ToastState = { message: string; variant: ToastVariant };
	type RuleDraft = {
		kind: RateLimitKind;
		subject: string;
		mode: RateLimitMode;
		limitPerMinute?: number;
		note?: string;
	};
	type Confirmation = {
		title: string;
		lines: string[];
		// Text the admin must retype before the action is allowed.
		typed?: string;
		action: () => Promise<void>;
	};

	const USAGE_POLL_MS = 5000;
	const DEFAULT_SUBJECT = '*';

	let config = $state<(RateLimitConfig & { knownPlatforms: string[] }) | null>(null);
	let usage = $state<RateLimitUsage | null>(null);
	let loadError = $state<string | null>(null);

	let platformDefault = $state(0);
	let ipDefault = $state(0);

	let formKind = $state<RateLimitKind>('ip');
	let formSubject = $state('');
	let formMode = $state<RateLimitMode>('limit');
	let formLimit = $state(1000);
	let formNote = $state('');
	let formElement = $state<HTMLElement | null>(null);

	let confirmation = $state<Confirmation | null>(null);
	let confirmText = $state('');
	let confirming = $state(false);

	let toast = $state<ToastState | null>(null);
	let toastTimeout: ReturnType<typeof setTimeout> | null = null;
	let usageTimer: ReturnType<typeof setInterval> | null = null;

	const showToast = (message: string, variant: ToastVariant) => {
		toast = { message, variant };
		if (toastTimeout) clearTimeout(toastTimeout);
		toastTimeout = setTimeout(() => (toast = null), 5000);
	};

	const rules = $derived(config?.rules ?? []);
	const ruleFor = (kind: RateLimitKind, subject: string) =>
		rules.find((rule) => rule.kind === kind && rule.subject === subject);
	const ipRules = $derived(
		rules.filter((rule) => rule.kind === 'ip' && rule.subject !== DEFAULT_SUBJECT)
	);

	// Every platform worth a row: one with a rule, with traffic this minute,
	// or listed by the Registry.
	const platformRows = $derived.by(() => {
		if (!config) return [];
		const live = new Map((usage?.platforms ?? []).map((row) => [row.subject, row]));
		const subjects = new Set<string>([
			...rules
				.filter((rule) => rule.kind === 'platform' && rule.subject !== DEFAULT_SUBJECT)
				.map((rule) => rule.subject),
			...live.keys(),
			...config.knownPlatforms
		]);
		return [...subjects]
			.map((subject) => ({
				subject,
				rule: ruleFor('platform', subject),
				usage: live.get(subject)
			}))
			.sort(
				(a, b) =>
					(b.usage?.count ?? 0) - (a.usage?.count ?? 0) ||
					a.subject.localeCompare(b.subject)
			);
	});

	async function readJson(response: Response) {
		const body = await response.json().catch(() => null);
		if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
		return body;
	}

	async function loadConfig() {
		try {
			config = await readJson(await fetch('/api/rate-limits'));
			platformDefault = config!.defaults.platform.limit;
			ipDefault = config!.defaults.ip.limit;
			loadError = null;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not load rate limits';
		}
	}

	async function loadUsage() {
		try {
			usage = await readJson(await fetch('/api/rate-limits/usage'));
		} catch {
			// The next poll retries; the config call reports what is wrong.
		}
	}

	// Resolves to whether the rule was saved, so a rejected draft is kept.
	async function saveRule(draft: RuleDraft): Promise<boolean> {
		try {
			await readJson(
				await fetch('/api/rate-limits/rules', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(draft)
				})
			);
			showToast(`Saved ${describe(draft)}`, 'success');
			await Promise.all([loadConfig(), loadUsage()]);
			return true;
		} catch (err) {
			showToast(err instanceof Error ? err.message : 'Could not save', 'error');
			return false;
		}
	}

	async function removeRule(rule: RateLimitRule) {
		try {
			const response = await fetch(`/api/rate-limits/rules/${rule.id}`, {
				method: 'DELETE'
			});
			if (!response.ok) await readJson(response);
			showToast('Rule removed', 'success');
			await Promise.all([loadConfig(), loadUsage()]);
		} catch (err) {
			showToast(err instanceof Error ? err.message : 'Could not remove', 'error');
		}
	}

	function describe(draft: RuleDraft): string {
		const who =
			draft.subject === DEFAULT_SUBJECT
				? `the ${draft.kind === 'ip' ? 'IP' : 'platform'} default`
				: draft.subject;
		return draft.mode === 'limit'
			? `${who} at ${draft.limitPerMinute}/min`
			: `${who} as ${draft.mode}`;
	}

	function isLocalRange(subject: string): boolean {
		return (
			/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(subject) ||
			/^(::1|fe80:|f[cd])/i.test(subject)
		);
	}

	function isWholeNumber(value: unknown): value is number {
		return typeof value === 'number' && Number.isInteger(value) && value >= 1;
	}

	function ask(next: Confirmation) {
		confirmText = '';
		confirmation = next;
	}

	async function runConfirmed() {
		if (!confirmation) return;
		confirming = true;
		try {
			await confirmation.action();
		} finally {
			confirming = false;
			confirmation = null;
		}
	}

	function submitDefault(kind: RateLimitKind) {
		const limit = kind === 'platform' ? platformDefault : ipDefault;
		if (!isWholeNumber(limit)) {
			showToast('Enter a whole number of requests per minute', 'error');
			return;
		}
		const current = config!.defaults[kind].limit;
		const draft: RuleDraft = {
			kind,
			subject: DEFAULT_SUBJECT,
			mode: 'limit',
			limitPerMinute: limit
		};
		if (limit < current) {
			ask({
				title: `Lower the ${kind} default?`,
				lines: [
					`Every ${kind} without its own rule drops from ${current} to ${limit} requests per minute, effective immediately.`
				],
				action: async () => void (await saveRule(draft))
			});
		} else {
			void saveRule(draft);
		}
	}

	function resetDefault(kind: RateLimitKind) {
		const rule = ruleFor(kind, DEFAULT_SUBJECT);
		if (!rule) return;
		ask({
			title: `Reset the ${kind} default?`,
			lines: [`The ${kind} default goes back to the value in evault-core's environment.`],
			action: () => removeRule(rule)
		});
	}

	function submitForm() {
		const subject = formSubject.trim();
		if (!subject || subject === DEFAULT_SUBJECT) {
			showToast(
				formKind === 'ip' ? 'Enter an IP or CIDR range' : 'Enter a platform',
				'error'
			);
			return;
		}
		if (formMode === 'limit' && !isWholeNumber(formLimit)) {
			showToast('Enter a whole number of requests per minute', 'error');
			return;
		}
		const draft: RuleDraft = {
			kind: formKind,
			subject,
			mode: formMode,
			...(formMode === 'limit' && { limitPerMinute: formLimit }),
			...(formNote.trim() && { note: formNote.trim() })
		};
		if (formMode === 'limit') {
			void saveAndClear(draft);
			return;
		}

		const lines: string[] = [];
		if (formMode === 'blocked') {
			lines.push(
				formKind === 'ip'
					? `Every request from ${subject} is refused with 403, effective immediately.`
					: `Requests carrying a ${subject} token are refused with 403. A caller can avoid this by minting a token under another name; block its IPs to stop it.`
			);
			if (formKind === 'ip' && isLocalRange(subject)) {
				lines.push(
					'This is a loopback or private range. Blocking it can cut off services running next to evault-core.'
				);
			}
		} else {
			lines.push(
				formKind === 'ip'
					? `Requests from ${subject} skip every rate limit, including platform limits.`
					: `${subject} skips its platform limit. Its callers are still held to their IP limits.`
			);
		}
		if (formKind === 'ip' && subject.includes('/')) {
			lines.push('This is a range: the rule applies to every address in it.');
		}
		ask({
			title: `${formMode === 'blocked' ? 'Block' : 'Exempt'} ${subject}?`,
			lines,
			typed: subject,
			action: () => saveAndClear(draft)
		});
	}

	async function saveAndClear(draft: RuleDraft) {
		if (await saveRule(draft)) clearForm();
	}

	function clearForm() {
		formSubject = '';
		formNote = '';
		formMode = 'limit';
	}

	function editRule(kind: RateLimitKind, subject: string, mode?: RateLimitMode) {
		const rule = ruleFor(kind, subject);
		formKind = kind;
		formSubject = subject;
		formMode = mode ?? rule?.mode ?? 'limit';
		formLimit = rule?.limitPerMinute ?? config!.defaults[kind].limit;
		formNote = rule?.note ?? '';
		formElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	function confirmRemove(rule: RateLimitRule) {
		ask({
			title: `Remove the rule for ${rule.subject}?`,
			lines: [
				rule.mode === 'blocked'
					? `${rule.subject} is unblocked and falls back to the ${rule.kind} default.`
					: `${rule.subject} falls back to the ${rule.kind} default of ${config!.defaults[rule.kind].limit}/min.`
			],
			action: () => removeRule(rule)
		});
	}

	function ruleLabel(rule: RateLimitRule | undefined, kind: RateLimitKind): string {
		if (!rule) return `Default (${config!.defaults[kind].limit}/min)`;
		if (rule.mode === 'limit') return `${rule.limitPerMinute}/min`;
		return rule.mode === 'blocked' ? 'Blocked' : 'Exempt';
	}

	function trustProxyLabel(value: RateLimitConfig['trustProxy']): string {
		if (value === false) return 'off (clients connect directly)';
		if (value === true) return 'every proxy trusted';
		return typeof value === 'number' ? `${value} proxy hop(s)` : value;
	}

	onMount(async () => {
		await Promise.all([loadConfig(), loadUsage()]);
		usageTimer = setInterval(loadUsage, USAGE_POLL_MS);
	});

	onDestroy(() => {
		if (usageTimer) clearInterval(usageTimer);
		if (toastTimeout) clearTimeout(toastTimeout);
	});
</script>

{#snippet usageCell(row: UsageRow | undefined)}
	{#if row}
		<span class={row.count > row.limit ? 'text-danger-500 font-semibold' : ''}>
			{row.count} / {row.limit}
		</span>
		{#if row.rejected > 0}
			<span class="text-danger-500 ml-2 text-xs">{row.rejected} rejected</span>
		{/if}
	{:else}
		<span class="text-black-300">—</span>
	{/if}
{/snippet}

{#snippet modeBadge(mode: RateLimitMode, label: string)}
	<span
		class={`rounded-full px-2 py-0.5 text-xs font-medium ${
			mode === 'blocked'
				? 'bg-danger-100 text-danger-500'
				: mode === 'exempt'
					? 'bg-primary-100 text-primary-500'
					: 'bg-black-100 text-black-700'
		}`}
	>
		{label}
	</span>
{/snippet}

<section class="max-w-6xl space-y-6">
	<div class="border-black-100 rounded-2xl border bg-white px-8 py-6 shadow-sm">
		<h2 class="text-2xl font-semibold text-black">Rate Limits</h2>
		<p class="text-black-700 mt-2">
			Requests to the eVault API are limited per IP, then per platform. Changes apply
			immediately, without a restart.
		</p>
		{#if loadError}
			<p class="bg-danger-100 text-danger-500 mt-4 rounded-lg px-4 py-3 text-sm">
				{loadError}
			</p>
		{:else if config}
			<div class="text-black-500 mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
				<span>
					Rules: {config.config.source === 'db'
						? 'loaded from the database'
						: 'database unavailable, using env defaults'}
				</span>
				<span>Loaded: {new Date(config.config.loadedAt).toLocaleTimeString()}</span>
				<span>Window: {config.windowSeconds}s</span>
				<span>Proxy trust: {trustProxyLabel(config.trustProxy)}</span>
			</div>
			<p class="text-black-500 mt-3 text-sm">
				Platform names are self-declared, so a platform rule never lifts a caller above its
				IP limit. To give a platform more headroom, also raise the limit on its server IPs.
				Counters are kept per evault-core instance.
			</p>
		{/if}
	</div>

	{#if config}
		<div class="border-black-100 rounded-2xl border bg-white px-8 py-6 shadow-sm">
			<h3 class="text-lg font-semibold text-black">Defaults</h3>
			<p class="text-black-500 mt-1 text-sm">
				Requests per minute for any platform or IP without its own rule.
			</p>
			<div class="mt-4 grid gap-6 md:grid-cols-2">
				{#each ['platform', 'ip'] as const as kind (kind)}
					<div>
						<label
							for={`default-${kind}`}
							class="text-black-700 mb-1 block text-sm font-medium"
						>
							Per {kind === 'ip' ? 'IP' : 'platform'}
							<span class="text-black-500 font-normal">
								({config.defaults[kind].source === 'env' ? 'from env' : 'set here'})
							</span>
						</label>
						<div class="flex items-center gap-2">
							{#if kind === 'platform'}
								<input
									id="default-platform"
									type="number"
									min="1"
									bind:value={platformDefault}
									class="border-black-100 w-40 rounded-lg border px-3 py-2 text-sm"
								/>
							{:else}
								<input
									id="default-ip"
									type="number"
									min="1"
									bind:value={ipDefault}
									class="border-black-100 w-40 rounded-lg border px-3 py-2 text-sm"
								/>
							{/if}
							<ButtonAction
								variant="soft"
								size="sm"
								callback={() => submitDefault(kind)}
							>
								Save
							</ButtonAction>
							{#if config.defaults[kind].source === 'db'}
								<ButtonAction
									variant="white"
									size="sm"
									class="whitespace-nowrap"
									callback={() => resetDefault(kind)}
								>
									Reset to env
								</ButtonAction>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>

		<div
			bind:this={formElement}
			class="border-black-100 rounded-2xl border bg-white px-8 py-6 shadow-sm"
		>
			<h3 class="text-lg font-semibold text-black">Add or change a rule</h3>
			<p class="text-black-500 mt-1 text-sm">
				Saving a rule for a subject that already has one replaces it. The most specific IP
				range wins.
			</p>
			<div class="mt-4 grid gap-4 md:grid-cols-4">
				<div>
					<label for="rule-kind" class="text-black-700 mb-1 block text-sm font-medium">
						Applies to
					</label>
					<select
						id="rule-kind"
						bind:value={formKind}
						class="border-black-100 w-full rounded-lg border px-3 py-2 text-sm"
					>
						<option value="ip">IP or range</option>
						<option value="platform">Platform</option>
					</select>
				</div>
				<div class="md:col-span-2">
					<label for="rule-subject" class="text-black-700 mb-1 block text-sm font-medium">
						{formKind === 'ip' ? 'IP address or CIDR range' : 'Platform'}
					</label>
					<input
						id="rule-subject"
						type="text"
						bind:value={formSubject}
						placeholder={formKind === 'ip'
							? '203.0.113.7 or 203.0.113.0/24'
							: 'https://pictique.example'}
						class="border-black-100 w-full rounded-lg border px-3 py-2 text-sm"
					/>
				</div>
				<div>
					<label for="rule-mode" class="text-black-700 mb-1 block text-sm font-medium">
						Action
					</label>
					<select
						id="rule-mode"
						bind:value={formMode}
						class="border-black-100 w-full rounded-lg border px-3 py-2 text-sm"
					>
						<option value="limit">Set limit</option>
						<option value="blocked">Block</option>
						<option value="exempt">Exempt</option>
					</select>
				</div>
				{#if formMode === 'limit'}
					<div>
						<label
							for="rule-limit"
							class="text-black-700 mb-1 block text-sm font-medium"
						>
							Requests per minute
						</label>
						<input
							id="rule-limit"
							type="number"
							min="1"
							bind:value={formLimit}
							class="border-black-100 w-full rounded-lg border px-3 py-2 text-sm"
						/>
					</div>
				{/if}
				<div class={formMode === 'limit' ? 'md:col-span-3' : 'md:col-span-4'}>
					<label for="rule-note" class="text-black-700 mb-1 block text-sm font-medium">
						Note (optional)
					</label>
					<input
						id="rule-note"
						type="text"
						maxlength="500"
						bind:value={formNote}
						placeholder="Why this rule exists"
						class="border-black-100 w-full rounded-lg border px-3 py-2 text-sm"
					/>
				</div>
			</div>
			<div class="mt-4">
				<ButtonAction
					variant={formMode === 'blocked' ? 'danger' : 'solid'}
					size="sm"
					class="whitespace-nowrap"
					callback={submitForm}
				>
					{formMode === 'limit'
						? 'Save rule'
						: formMode === 'blocked'
							? 'Block…'
							: 'Exempt…'}
				</ButtonAction>
			</div>
		</div>

		<div class="border-black-100 rounded-2xl border bg-white px-8 py-6 shadow-sm">
			<h3 class="text-lg font-semibold text-black">Platforms</h3>
			<p class="text-black-500 mt-1 text-sm">
				Platforms with a rule, with traffic in the current window, or listed by the
				Registry.
			</p>
			<div class="mt-4 overflow-x-auto">
				<table class="w-full text-left text-sm">
					<thead class="text-black-500 border-black-100 border-b">
						<tr>
							<th class="py-2 pr-4 font-medium">Platform</th>
							<th class="py-2 pr-4 font-medium">Limit</th>
							<th class="py-2 pr-4 font-medium">This window</th>
							<th class="py-2 font-medium"></th>
						</tr>
					</thead>
					<tbody>
						{#each platformRows as row (row.subject)}
							<tr class="border-black-100 border-b last:border-0">
								<td class="py-2 pr-4 break-all">
									{row.subject}
									{#if row.rule?.note}
										<p class="text-black-500 text-xs">{row.rule.note}</p>
									{/if}
								</td>
								<td class="py-2 pr-4 whitespace-nowrap">
									{@render modeBadge(
										row.rule?.mode ?? 'limit',
										ruleLabel(row.rule, 'platform')
									)}
								</td>
								<td class="py-2 pr-4 whitespace-nowrap">
									{@render usageCell(row.usage)}
								</td>
								<td class="py-2 text-right whitespace-nowrap">
									<button
										class="text-primary-500 font-medium"
										onclick={() => editRule('platform', row.subject)}
									>
										{row.rule ? 'Change' : 'Set rule'}
									</button>
									{#if row.rule}
										<button
											class="text-danger-500 ml-4 font-medium"
											onclick={() => confirmRemove(row.rule!)}
										>
											Remove
										</button>
									{/if}
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan="4" class="text-black-500 py-4">
									No platforms seen yet.
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<div class="border-black-100 rounded-2xl border bg-white px-8 py-6 shadow-sm">
			<h3 class="text-lg font-semibold text-black">IP rules</h3>
			<div class="mt-4 overflow-x-auto">
				<table class="w-full text-left text-sm">
					<thead class="text-black-500 border-black-100 border-b">
						<tr>
							<th class="py-2 pr-4 font-medium">IP or range</th>
							<th class="py-2 pr-4 font-medium">Limit</th>
							<th class="py-2 pr-4 font-medium">Note</th>
							<th class="py-2 pr-4 font-medium">Changed by</th>
							<th class="py-2 font-medium"></th>
						</tr>
					</thead>
					<tbody>
						{#each ipRules as rule (rule.id)}
							<tr class="border-black-100 border-b last:border-0">
								<td class="py-2 pr-4 font-mono">{rule.subject}</td>
								<td class="py-2 pr-4 whitespace-nowrap">
									{@render modeBadge(rule.mode, ruleLabel(rule, 'ip'))}
								</td>
								<td class="text-black-700 py-2 pr-4">{rule.note ?? ''}</td>
								<td class="text-black-500 py-2 pr-4 text-xs">
									{rule.updatedBy ?? ''}
								</td>
								<td class="py-2 text-right whitespace-nowrap">
									<button
										class="text-primary-500 font-medium"
										onclick={() => editRule('ip', rule.subject)}
									>
										Change
									</button>
									<button
										class="text-danger-500 ml-4 font-medium"
										onclick={() => confirmRemove(rule)}
									>
										Remove
									</button>
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan="5" class="text-black-500 py-4">
									No IP rules. Every IP gets the default.
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<div class="border-black-100 rounded-2xl border bg-white px-8 py-6 shadow-sm">
			<h3 class="text-lg font-semibold text-black">Live IPs</h3>
			<p class="text-black-500 mt-1 text-sm">
				Callers in the current window, closest to their limit first. Blocked and exempt IPs
				are not counted.
				{#if usage?.truncated}
					Showing the busiest 200.
				{/if}
			</p>
			<div class="mt-4 overflow-x-auto">
				<table class="w-full text-left text-sm">
					<thead class="text-black-500 border-black-100 border-b">
						<tr>
							<th class="py-2 pr-4 font-medium">IP</th>
							<th class="py-2 pr-4 font-medium">This window</th>
							<th class="py-2 pr-4 font-medium">Rule</th>
							<th class="py-2 pr-4 font-medium">Resets in</th>
							<th class="py-2 font-medium"></th>
						</tr>
					</thead>
					<tbody>
						{#each usage?.ips ?? [] as row (row.subject)}
							<tr class="border-black-100 border-b last:border-0">
								<td class="py-2 pr-4 font-mono">{row.subject}</td>
								<td class="py-2 pr-4 whitespace-nowrap">
									{@render usageCell(row)}
								</td>
								<td class="text-black-500 py-2 pr-4 font-mono text-xs">
									{row.matchedRule ?? 'default'}
								</td>
								<td class="text-black-500 py-2 pr-4">{row.resetsInSeconds}s</td>
								<td class="py-2 text-right whitespace-nowrap">
									<button
										class="text-primary-500 font-medium"
										onclick={() => editRule('ip', row.subject, 'limit')}
									>
										Set limit
									</button>
									<button
										class="text-danger-500 ml-4 font-medium"
										onclick={() => editRule('ip', row.subject, 'blocked')}
									>
										Block
									</button>
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan="5" class="text-black-500 py-4">
									No requests in the current window.
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</section>

{#if confirmation}
	<div
		class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="confirm-title"
	>
		<div class="w-full max-w-lg rounded-2xl bg-white px-8 py-6 shadow-xl">
			<h3 id="confirm-title" class="text-lg font-semibold break-all text-black">
				{confirmation.title}
			</h3>
			{#each confirmation.lines as line (line)}
				<p class="text-black-700 mt-3 text-sm">{line}</p>
			{/each}
			{#if confirmation.typed}
				<label for="confirm-typed" class="text-black-700 mt-4 block text-sm font-medium">
					Type <span class="font-mono">{confirmation.typed}</span> to confirm
				</label>
				<input
					id="confirm-typed"
					type="text"
					bind:value={confirmText}
					autocomplete="off"
					class="border-black-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
				/>
			{/if}
			<div class="mt-6 flex justify-end gap-3">
				<ButtonAction
					variant="white"
					size="sm"
					callback={() => {
						confirmation = null;
					}}
				>
					Cancel
				</ButtonAction>
				<ButtonAction
					variant="danger"
					size="sm"
					isLoading={confirming}
					disabled={Boolean(confirmation.typed) &&
						confirmText.trim() !== confirmation.typed}
					callback={runConfirmed}
				>
					Confirm
				</ButtonAction>
			</div>
		</div>
	</div>
{/if}

{#if toast}
	<div
		class={`fixed top-24 right-6 z-50 rounded-lg border px-4 py-3 shadow-lg ${
			toast.variant === 'success'
				? 'border-green-200 bg-green-100 text-green-800'
				: 'border-danger-200 bg-danger-100 text-danger-500'
		}`}
	>
		<p class="font-semibold">{toast.message}</p>
	</div>
{/if}
