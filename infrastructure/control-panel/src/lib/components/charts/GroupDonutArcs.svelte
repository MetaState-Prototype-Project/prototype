<script lang="ts">
	import { getContext } from 'svelte';
	import { arc, pie, type PieArcDatum } from 'd3-shape';

	type DonutSlice = {
		id: string;
		label: string;
		sub: string;
		value: number;
		color: string;
		bucketKey: string;
		evaultPageId: string | null;
	};

	type Ctx = {
		width: import('svelte/store').Readable<number>;
		height: import('svelte/store').Readable<number>;
		data: import('svelte/store').Readable<DonutSlice[]>;
	};

	const { width, height, data } = getContext('LayerCake') as Ctx;

	interface Props {
		groupEvaultId: string;
	}
	let { groupEvaultId }: Props = $props();

	const sliceHref = (bucketKey: string) =>
		`/groups/${encodeURIComponent(groupEvaultId)}/messages?bucket=${encodeURIComponent(bucketKey)}`;

	const pieLayout = pie<DonutSlice>().value((d) => d.value).sort(null);
</script>

<g transform="translate({$width / 2},{$height / 2})">
	{#each pieLayout($data ?? []) as a (a.data.id)}
		{@const outerR = Math.min($width, $height) / 2 - 6}
		{@const innerR = outerR * 0.56}
		{@const d = arc<PieArcDatum<DonutSlice>>()
			.innerRadius(innerR)
			.outerRadius(outerR)
			.cornerRadius(1.5)(a)}
		{#if d}
			<a
				href={sliceHref(a.data.bucketKey)}
				class="cursor-pointer outline-none transition-opacity hover:opacity-90 focus-visible:opacity-90"
			>
				<path {d} fill={a.data.color} stroke="#fff" stroke-width="1.5" class="outline-none">
					<title>{a.data.label} — {a.data.sub}: {a.data.value} messages (open list)</title>
				</path>
			</a>
		{/if}
	{/each}
</g>
