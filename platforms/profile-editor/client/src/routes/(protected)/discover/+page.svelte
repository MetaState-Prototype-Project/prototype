<script lang="ts">
	import { onMount } from 'svelte';
	import { searchProfiles, searchResults, searchLoading, searchTotal, searchPage, searchTotalPages } from '$lib/stores/discovery';
	import ProfileCard from '$lib/components/profile/ProfileCard.svelte';
	import { Input } from '@metastate-foundation/ui/input';
	import { Button } from '@metastate-foundation/ui/button';
	import { Badge } from '@metastate-foundation/ui/badge';
	import { Skeleton } from '@metastate-foundation/ui/skeleton';

	let query = $state('');
	let skillFilter = $state('');
	let activeSkills = $state<string[]>([]);
	let currentPage = $state(1);
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		searchProfiles('', { page: 1, limit: 12 });
	});

	function doSearch(page: number = 1) {
		currentPage = page;
		searchProfiles(query, { skills: activeSkills, page, limit: 12 });
	}

	function handleInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => doSearch(1), 300);
	}

	function handleSearch() {
		clearTimeout(debounceTimer);
		doSearch(1);
	}

	async function goToPage(page: number) {
		doSearch(page);
	}

	function addSkillFilter() {
		const trimmed = skillFilter.trim();
		if (trimmed && !activeSkills.includes(trimmed)) {
			activeSkills = [...activeSkills, trimmed];
			skillFilter = '';
			doSearch(1);
		}
	}

	function removeSkillFilter(skill: string) {
		activeSkills = activeSkills.filter((s) => s !== skill);
		doSearch(1);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleSearch();
		}
	}

	function handleSkillKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addSkillFilter();
		}
	}
</script>

<svelte:head>
	<title>Discover - Profile Editor</title>
</svelte:head>

<div class="mx-auto max-w-4xl">
	<div class="mb-8">
		<h1 class="text-2xl font-bold text-foreground">Discover People</h1>
		<p class="mt-1 text-sm text-muted-foreground">Find professionals in the W3DS ecosystem</p>
	</div>

	<!-- Search bar -->
	<div class="mb-6 flex gap-3">
		<Input
			bind:value={query}
			oninput={handleInput}
			onkeydown={handleKeydown}
			placeholder="Search by name, headline, skills..."
			class="flex-1"
		/>
		<Button onclick={handleSearch} disabled={$searchLoading}>
			{$searchLoading ? 'Searching...' : 'Search'}
		</Button>
	</div>

	<!-- Skill filters -->
	<div class="mb-6">
		<div class="flex items-center gap-2">
			<Input
				bind:value={skillFilter}
				onkeydown={handleSkillKeydown}
				placeholder="Filter by skill..."
				class="w-48"
			/>
			<Button variant="outline" size="sm" onclick={addSkillFilter}>Add filter</Button>
		</div>
		{#if activeSkills.length}
			<div class="mt-2 flex flex-wrap gap-2">
				{#each activeSkills as skill}
					<Badge variant="default" class="gap-1">
						{skill}
						<button onclick={() => removeSkillFilter(skill)} class="ml-0.5 rounded-full p-0.5 hover:bg-primary-foreground/20">
							<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
						</button>
					</Badge>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Results -->
	{#if $searchLoading}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each Array(6) as _}
				<Skeleton class="h-32 w-full rounded-xl" />
			{/each}
		</div>
	{:else if $searchResults.length}
		<p class="mb-4 text-sm text-muted-foreground">{$searchTotal} result{$searchTotal !== 1 ? 's' : ''} found</p>
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each $searchResults as result}
				<ProfileCard {result} />
			{/each}
		</div>

		<!-- Pagination -->
		{#if $searchTotalPages > 1}
			<div class="mt-8 flex items-center justify-center gap-2">
				<Button variant="outline" size="sm" onclick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
					Previous
				</Button>
				<span class="px-3 text-sm text-muted-foreground">
					Page {currentPage} of {$searchTotalPages}
				</span>
				<Button variant="outline" size="sm" onclick={() => goToPage(currentPage + 1)} disabled={currentPage >= $searchTotalPages}>
					Next
				</Button>
			</div>
		{/if}
	{:else if query.trim()}
		<div class="flex flex-col items-center justify-center py-16 text-center">
			<p class="text-muted-foreground">No profiles found for "{query}"</p>
			<p class="mt-1 text-sm text-muted-foreground/60">Try different keywords or remove filters</p>
		</div>
	{:else}
		<div class="flex flex-col items-center justify-center py-16 text-center">
			<p class="text-muted-foreground">No public profiles yet</p>
		</div>
	{/if}
</div>
