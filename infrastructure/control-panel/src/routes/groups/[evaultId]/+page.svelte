<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import GroupContributionDonut from '$lib/components/charts/GroupContributionDonut.svelte';
	import type { GroupInsights } from '$lib/services/evaultService';
	import { EVaultService } from '$lib/services/evaultService';
	import { onMount } from 'svelte';

	let insights = $state<GroupInsights | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	const evaultId = $derived(page.params.evaultId ?? '');

	function asString(v: unknown): string {
		return typeof v === 'string' && v.trim() ? v.trim() : '';
	}

	async function load() {
		const id = evaultId;
		if (!id) {
			error = 'Missing group id';
			isLoading = false;
			return;
		}
		try {
			isLoading = true;
			error = null;
			insights = await EVaultService.getGroupInsights(id);
		} catch (e) {
			insights = null;
			error = e instanceof Error ? e.message : 'Failed to load group insights';
		} finally {
			isLoading = false;
		}
	}

	onMount(load);
</script>

<svelte:head>
	<title>Group {insights?.manifest?.name ?? evaultId} — Control Panel</title>
</svelte:head>

<div class="mb-6">
	<button
		type="button"
		class="mb-4 text-sm text-blue-600 hover:underline"
		onclick={() => goto('/groups')}
	>
		← Back to groups
	</button>
	{#if isLoading}
		<div class="flex py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
		</div>
	{:else if error}
		<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
			<p class="font-medium">Could not load this group</p>
			<p class="mt-1 text-sm">{error}</p>
			<button
				type="button"
				class="mt-3 rounded bg-red-700 px-3 py-1 text-sm text-white hover:bg-red-800"
				onclick={load}
			>
				Retry
			</button>
		</div>
	{:else if insights}
		{@const m = insights.manifest}
		{@const stats = insights.messageStats}
		{@const withSender = stats.messagesWithSenderBucket}
		{@const withoutSender = stats.messagesWithoutSender}
		<p class="text-sm font-medium text-gray-500">Real name</p>
		<h1 class="text-3xl font-bold text-gray-900">
			{asString(m.name) || insights.evault.ename || evaultId}
		</h1>
		<p class="mt-3 text-sm text-gray-600">
			<span class="text-gray-500">eName</span>
			<span class="ml-2 font-mono text-gray-900">{insights.evault.ename}</span>
		</p>
		{#if asString(m.description)}
			<p class="mt-3 max-w-3xl text-gray-700">{asString(m.description)}</p>
		{/if}

		<div class="mt-8 grid gap-6 lg:grid-cols-2">
			<div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
				<h2 class="text-lg font-semibold text-gray-900">Vault</h2>
				<dl class="mt-3 space-y-2 text-sm">
					<div class="flex gap-2">
						<dt class="w-28 shrink-0 text-gray-500">eVault ID</dt>
						<dd class="font-mono text-gray-900">{insights.evault.evault || '—'}</dd>
					</div>
					<div class="flex gap-2">
						<dt class="w-28 shrink-0 text-gray-500">URI</dt>
						<dd class="break-all">
							<a
								href={insights.evault.uri}
								class="text-blue-600 hover:underline"
								target="_blank"
								rel="noopener noreferrer">{insights.evault.uri}</a
							>
						</dd>
					</div>
				</dl>
			</div>

			<div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
				<h2 class="text-lg font-semibold text-gray-900">Messages</h2>
				<p class="mt-2 text-2xl font-semibold text-gray-900">
					{stats.totalCount ?? stats.messagesScanned}
					<span class="text-base font-normal text-gray-500">total in vault</span>
				</p>
				<p class="mt-1 text-sm text-gray-600">
					Scanned {stats.messagesScanned} message envelope(s):{' '}
					<span class="font-medium text-gray-800">{withSender}</span>
					with a sender id or resolvable <code class="text-xs">ename</code> (bucketed in the table
					below),
					<span class="font-medium text-gray-800">{withoutSender}</span>
					with no sender in the payload (system / null).
				</p>
				{#if stats.capped}
					<p class="mt-2 text-sm text-amber-800">
						Counts may be incomplete: scanning stopped at the safety limit ({stats.messagesScanned}
						messages).
					</p>
				{/if}
			</div>
		</div>

		<div class="mt-8">
			<GroupContributionDonut senderRows={stats.senderRows ?? []} groupEvaultId={evaultId} />
		</div>

		<div class="mt-8 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
			<div class="border-b border-gray-200 px-5 py-3">
				<h2 class="text-lg font-semibold text-gray-900">Messages by sender</h2>
				<p class="text-sm text-gray-500">
					Real name comes from each sender’s user vault (same fields as the dashboard). eName is the
					W3ID when we can match the registry; otherwise the raw sender id from the message.
				</p>
			</div>
			<div class="overflow-x-auto">
				{#if stats.senderRows?.length}
					<table class="min-w-full divide-y divide-gray-200 text-sm">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-4 py-2 text-left font-medium text-gray-600">Real name</th>
								<th class="px-4 py-2 text-left font-medium text-gray-600">eName</th>
								<th class="px-4 py-2 text-right font-medium text-gray-600">Count</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100">
							{#each stats.senderRows as row}
								<tr class={row.ename === '—' ? 'bg-gray-50/80' : ''}>
									<td class="px-4 py-2 text-gray-900">
										{#if row.evaultPageId}
											<a
												href="/evaults/{encodeURIComponent(row.evaultPageId)}"
												class="font-medium text-blue-600 hover:underline">{row.displayName}</a>
										{:else}
											{row.displayName}
										{/if}
									</td>
									<td class="px-4 py-2 font-mono text-gray-900">{row.ename}</td>
									<td class="px-4 py-2 text-right font-medium">
										<a
											href="/groups/{encodeURIComponent(evaultId)}/messages?bucket={encodeURIComponent(
												row.bucketKey
											)}"
											class="text-blue-600 hover:underline">{row.messageCount}</a>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{:else}
					<p class="px-5 py-6 text-center text-gray-500">No message rows.</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
