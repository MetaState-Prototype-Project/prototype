<script lang="ts">
	interface Props {
		allNodes: { id: string; label: string }[];
		allRefTypes: string[];
		hasActiveFilters: boolean;
		focusNodeId: string | null;
		focusLabel: string;
		depth: number;
		targetTypeFilters: Record<string, boolean>;
		refTypeFilters: Record<string, boolean>;
		minScore: number;
	}

	let {
		allNodes,
		allRefTypes,
		hasActiveFilters,
		focusNodeId = $bindable(),
		focusLabel = $bindable(),
		depth = $bindable(),
		targetTypeFilters = $bindable(),
		refTypeFilters = $bindable(),
		minScore = $bindable()
	}: Props = $props();

	// Internal UI state — not needed outside this component
	let searchQuery = $state('');
	let showDropdown = $state(false);

	const searchResults = $derived.by(() => {
		if (!searchQuery) return [];
		const q = searchQuery.toLowerCase();
		return allNodes.filter((n) => n.label.toLowerCase().includes(q)).slice(0, 8);
	});

	function setFocus(id: string, label: string) {
		focusNodeId = id;
		focusLabel = label;
		searchQuery = '';
		showDropdown = false;
	}

	function clearFocus() {
		focusNodeId = null;
		focusLabel = '';
	}

	function resetAll() {
		clearFocus();
		depth = 3;
		minScore = 0;
		for (const k in targetTypeFilters) targetTypeFilters[k] = true;
		for (const k in refTypeFilters) refTypeFilters[k] = true;
	}
</script>

<aside
	class="flex w-60 shrink-0 flex-col gap-4 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 text-sm"
>
	<!-- Node search / focus -->
	<div>
		<p class="filter-label">Focus node</p>
		{#if focusNodeId}
			<div
				class="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-700"
			>
				<span class="min-w-0 flex-1 truncate">{focusLabel}</span>
				<button
					onclick={clearFocus}
					aria-label="Clear focus"
					class="ml-1 shrink-0 cursor-pointer text-red-400 hover:text-red-700">✕</button
				>
			</div>
		{:else}
			<div class="relative">
				<input
					type="text"
					placeholder="Search nodes…"
					bind:value={searchQuery}
					onfocus={() => (showDropdown = true)}
					onblur={() => setTimeout(() => (showDropdown = false), 150)}
					class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
				/>
				{#if showDropdown && searchResults.length > 0}
					<ul
						class="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-md"
					>
						{#each searchResults as r}
							<li>
								<button
									class="w-full px-2 py-1.5 text-left text-xs hover:bg-blue-50"
									onmousedown={(e) => {
										e.preventDefault();
										setFocus(r.id, r.label);
									}}
									onclick={() => setFocus(r.id, r.label)}
								>
									{r.label}
									<span class="ml-1 text-gray-400">{r.id.split(':')[0]}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Depth slider -->
	<div>
		<p class="filter-label">
			Depth (hops)
			<span class="ml-auto font-bold text-gray-700">{depth}</span>
		</p>
		<input
			type="range"
			min="1"
			max="6"
			step="1"
			bind:value={depth}
			disabled={!focusNodeId}
			class="w-full accent-blue-500 disabled:opacity-40"
		/>
		<div class="flex justify-between text-xs text-gray-400">
			<span>1</span><span>6</span>
		</div>
		{#if !focusNodeId}
			<p class="mt-0.5 text-xs text-gray-400 italic">Set a focus node to enable</p>
		{/if}
	</div>

	<!-- Target type filters -->
	<div>
		<p class="filter-label">Target type</p>
		{#each Object.keys(targetTypeFilters) as tt}
			<label class="flex cursor-pointer items-center gap-2 py-0.5 text-xs">
				<input
					type="checkbox"
					bind:checked={targetTypeFilters[tt]}
					class="accent-blue-500"
				/>
				{tt}
			</label>
		{/each}
	</div>

	<!-- Reference type filters -->
	{#if allRefTypes.length > 0}
		<div>
			<p class="filter-label">Reference type</p>
			{#each allRefTypes as rt}
				<label class="flex cursor-pointer items-center gap-2 py-0.5 text-xs">
					<input
						type="checkbox"
						bind:checked={refTypeFilters[rt]}
						class="accent-blue-500"
					/>
					{rt}
				</label>
			{/each}
		</div>
	{/if}

	<!-- Min score -->
	<div>
		<p class="filter-label">Min score</p>
		{#each [0, 1, 2, 3, 4] as s}
			<label class="flex cursor-pointer items-center gap-2 py-0.5 text-xs">
				<input
					type="radio"
					name="minscore"
					value={s}
					bind:group={minScore}
					class="accent-blue-500"
				/>
				{s === 0 ? 'Any' : `≥ ${s}`}
			</label>
		{/each}
	</div>

	<!-- Reset -->
	{#if hasActiveFilters}
		<button
			onclick={resetAll}
			class="mt-auto rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold hover:bg-gray-100"
		>
			Reset all filters
		</button>
	{/if}
</aside>

<style>
	.filter-label {
		display: flex;
		align-items: center;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #6b7280;
		margin-bottom: 0.35rem;
	}
</style>
