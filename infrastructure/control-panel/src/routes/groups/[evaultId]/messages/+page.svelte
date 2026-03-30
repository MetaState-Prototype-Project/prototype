<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { GroupMessagesForSenderResponse } from '$lib/services/evaultService';
	import { EVaultService } from '$lib/services/evaultService';

	let payload = $state<GroupMessagesForSenderResponse | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	const evaultId = $derived(page.params.evaultId ?? '');
	const bucket = $derived(page.url.searchParams.get('bucket') ?? '');

	const groupHref = $derived(`/groups/${encodeURIComponent(evaultId)}`);

	$effect(() => {
		if (!browser) {
			return;
		}
		const id = page.params.evaultId ?? '';
		const b = page.url.searchParams.get('bucket') ?? '';
		let cancelled = false;

		async function run() {
			if (!id) {
				error = 'Missing group id';
				payload = null;
				isLoading = false;
				return;
			}
			if (!b) {
				error =
					'Missing bucket query parameter. Open this page from a sender row or chart slice on the group.';
				payload = null;
				isLoading = false;
				return;
			}

			isLoading = true;
			error = null;
			try {
				const data = await EVaultService.getGroupMessagesForSender(id, b);
				if (!cancelled) {
					payload = data;
				}
			} catch (e) {
				if (!cancelled) {
					payload = null;
					error = e instanceof Error ? e.message : 'Failed to load messages';
				}
			} finally {
				if (!cancelled) {
					isLoading = false;
				}
			}
		}

		void run();
		return () => {
			cancelled = true;
		};
	});

	async function retry() {
		const id = evaultId;
		const b = bucket;
		if (!id || !b) {
			return;
		}
		isLoading = true;
		error = null;
		try {
			payload = await EVaultService.getGroupMessagesForSender(id, b);
		} catch (e) {
			payload = null;
			error = e instanceof Error ? e.message : 'Failed to load messages';
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>
		{payload
			? `${payload.senderDisplayName} · ${payload.groupDisplayName} — Control Panel`
			: 'Messages in group — Control Panel'}
	</title>
</svelte:head>

<div class="mb-6">
	<button
		type="button"
		class="mb-4 text-sm text-blue-600 hover:underline"
		onclick={() => goto(groupHref)}
	>
		← Back to group
	</button>

	{#if isLoading}
		<div class="flex py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
		</div>
	{:else if error}
		<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
			<p class="font-medium">Could not load messages</p>
			<p class="mt-1 text-sm">{error}</p>
			<button
				type="button"
				class="mt-3 rounded bg-red-700 px-3 py-1 text-sm text-white hover:bg-red-800"
				onclick={retry}
			>
				Retry
			</button>
		</div>
	{:else if payload}
		<p class="text-sm font-medium text-gray-500">Real name</p>
		<h1 class="text-3xl font-bold text-gray-900">{payload.senderDisplayName}</h1>
		<p class="mt-3 text-sm text-gray-600">
			<span class="text-gray-500">eName</span>
			<span class="ml-2 font-mono text-gray-900">{payload.senderEname}</span>
		</p>

		<div class="mt-6 border-t border-gray-200 pt-5">
			<p class="text-sm font-medium text-gray-500">Group</p>
			<p class="mt-1 text-xl font-semibold text-gray-900">{payload.groupDisplayName}</p>
			<p class="mt-2 text-sm text-gray-600">
				<span class="text-gray-500">eName</span>
				<span class="ml-2 font-mono text-gray-900">{payload.evault.ename}</span>
			</p>
		</div>

		<p class="mt-4 text-sm text-gray-600">
			Bucket <code class="rounded bg-gray-100 px-1 text-xs">{payload.bucket}</code>
			· matched {payload.matchedCount} of {payload.messagesScanned} scanned
			{#if payload.totalCount}
				· {payload.totalCount} total messages in vault (reported)
			{/if}
		</p>
		{#if payload.capped}
			<p class="mt-2 text-sm text-amber-800">
				Scan stopped at the safety limit; this list may be incomplete.
			</p>
		{/if}

		<ul class="mt-8 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
			{#each payload.messages as m, i (m.id ?? `idx-${i}`)}
				<li class="px-4 py-3 text-sm">
					{#if m.id}
						<p class="font-mono text-xs text-gray-400">{m.id}</p>
					{/if}
					<p class="mt-1 text-gray-900">
						{m.preview ?? '(no text preview)'}
					</p>
				</li>
			{:else}
				<li class="px-4 py-8 text-center text-gray-500">
					No messages in this bucket for the scanned range.
				</li>
			{/each}
		</ul>
	{/if}
</div>
