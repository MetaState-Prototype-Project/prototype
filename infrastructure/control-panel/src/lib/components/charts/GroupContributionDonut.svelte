<script lang="ts">
	import { LayerCake, Svg } from 'layercake';
	import {
		GROUP_NO_SENDER_BUCKET_KEY,
		type GroupSenderRow
	} from '$lib/services/evaultService';
	import GroupDonutArcs from './GroupDonutArcs.svelte';

	interface Props {
		senderRows: GroupSenderRow[];
		/** Group route param; used for per-sender message list links. */
		groupEvaultId: string;
	}
	let { senderRows, groupEvaultId }: Props = $props();

	/** When false (default), system / no-sender bucket is omitted from the donut and legend. */
	let showSystemNoSender = $state(false);

	function isSystemNoSenderRow(r: GroupSenderRow): boolean {
		return (
			r.bucketKey === GROUP_NO_SENDER_BUCKET_KEY ||
			r.ename === '—' ||
			r.displayName.trim().toLowerCase() === 'system / no sender'
		);
	}

	type DonutSlice = {
		id: string;
		label: string;
		sub: string;
		value: number;
		color: string;
		bucketKey: string;
		evaultPageId: string | null;
	};

	const PALETTE = [
		'#2563eb',
		'#7c3aed',
		'#0d9488',
		'#059669',
		'#d97706',
		'#dc2626',
		'#db2777',
		'#4f46e5',
		'#ea580c',
		'#0891b2'
	];

	const slices = $derived.by((): DonutSlice[] => {
		const rows = senderRows.filter((r) => {
			if (!showSystemNoSender && isSystemNoSenderRow(r)) {
				return false;
			}
			return r.messageCount > 0;
		});
		return rows.map((r, i) => ({
			id: `${i}-${r.bucketKey}`,
			label: r.displayName,
			sub: r.ename === '—' ? 'No sender' : r.ename,
			value: r.messageCount,
			color: PALETTE[i % PALETTE.length],
			bucketKey: r.bucketKey,
			evaultPageId: r.evaultPageId
		}));
	});

	const totalMessages = $derived(slices.reduce((s, x) => s + x.value, 0));

	const messagesListHref = (bucketKey: string) =>
		`/groups/${encodeURIComponent(groupEvaultId)}/messages?bucket=${encodeURIComponent(bucketKey)}`;
</script>

<div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
	<h2 class="text-lg font-semibold text-gray-900">Contribution by sender</h2>
	<p class="mt-1 text-sm text-gray-500">
		Share of scanned messages per sender (same counts as the table below)
	</p>

	{#if senderRows.some((r) => isSystemNoSenderRow(r) && r.messageCount > 0)}
		<label
			class="mt-4 flex cursor-pointer items-center gap-2 text-sm text-gray-700 select-none"
		>
			<input
				type="checkbox"
				bind:checked={showSystemNoSender}
				class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
			/>
			<span>Show system / no sender messages in chart</span>
		</label>
	{/if}

	{#if slices.length === 0}
		<p class="mt-6 text-center text-sm text-gray-500">No sender data to chart.</p>
	{:else}
		<div class="mt-6 flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-10">
			<div
				class="layercake-donut h-[min(22rem,55vw)] min-h-[220px] w-full max-w-[22rem] shrink-0"
			>
				<LayerCake
					ssr={true}
					data={slices}
					x="id"
					y="value"
					xDomain={slices.map((s) => s.id)}
					yDomain={[0, Math.max(...slices.map((s) => s.value), 1)]}
					padding={{ top: 8, right: 8, bottom: 8, left: 8 }}
				>
					<Svg label="Donut chart of messages per sender">
						<GroupDonutArcs {groupEvaultId} />
					</Svg>
				</LayerCake>
			</div>

			<ul class="min-w-0 flex-1 space-y-2 text-sm">
				{#each slices as s (s.id)}
					{@const pct =
						totalMessages > 0 ? Math.round((s.value / totalMessages) * 1000) / 10 : 0}
					<li class="flex items-start gap-3">
						<span
							class="mt-1.5 h-3 w-3 shrink-0 rounded-sm ring-1 ring-gray-200"
							style:background-color={s.color}
							aria-hidden="true"
						></span>
						<div class="min-w-0 flex-1">
							<div class="font-medium text-gray-900">
								{#if s.evaultPageId}
									<a
										href="/evaults/{encodeURIComponent(s.evaultPageId)}"
										class="text-blue-600 hover:underline">{s.label}</a>
								{:else}
									{s.label}
								{/if}
							</div>
							<div class="truncate font-mono text-xs text-gray-500">{s.sub}</div>
						</div>
						<div class="shrink-0 text-right text-gray-700 tabular-nums">
							<a href={messagesListHref(s.bucketKey)} class="text-blue-600 hover:underline"
								>{s.value}</a>
							<span class="text-gray-400">({pct}%)</span>
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<style>
	.layercake-donut :global(.layercake-container) {
		width: 100%;
		height: 100%;
	}
</style>
