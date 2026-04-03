<script lang="ts">
	import type { ProfileSearchResult } from '$lib/stores/discovery';
	import { PUBLIC_PROFILE_EDITOR_BASE_URL } from '$env/static/public';
	import { Card, CardContent } from '@metastate-foundation/ui/card';
	import { Avatar, AvatarImage, AvatarFallback } from '@metastate-foundation/ui/avatar';
	import { Badge } from '@metastate-foundation/ui/badge';

	let { result }: { result: ProfileSearchResult } = $props();

	function avatarProxyUrl(): string | null {
		if (result.ename) {
			return `${PUBLIC_PROFILE_EDITOR_BASE_URL}/api/profiles/${result.ename}/avatar`;
		}
		return null;
	}
</script>

<a href="/profile/{result.ename}" class="block">
	<Card class="h-full transition-shadow hover:shadow-md">
		<CardContent class="flex flex-col items-center p-5 text-center">
			<Avatar class="mb-3 h-16 w-16">
				{#if avatarProxyUrl()}
					<AvatarImage src={avatarProxyUrl()} alt={result.name} />
				{/if}
				<AvatarFallback class="text-xl font-bold">
					{(result.name || result.ename || '?')[0]?.toUpperCase()}
				</AvatarFallback>
			</Avatar>

			<div class="flex items-center gap-1.5">
				<h3 class="truncate text-sm font-semibold text-foreground">{result.name || result.ename}</h3>
				{#if result.isVerified}
					<Badge variant="default" class="text-[10px] px-1.5 py-0">Verified</Badge>
				{/if}
			</div>

			{#if result.headline}
				<p class="mt-1 line-clamp-2 text-xs text-muted-foreground">{result.headline}</p>
			{/if}
			{#if result.location}
				<p class="mt-1 text-xs text-muted-foreground/60">{result.location}</p>
			{/if}
			{#if result.skills?.length}
				<div class="mt-3 flex flex-wrap justify-center gap-1">
					{#each result.skills.slice(0, 3) as skill}
						<Badge variant="secondary" class="text-[11px]">{skill}</Badge>
					{/each}
					{#if result.skills.length > 3}
						<Badge variant="outline" class="text-[11px]">+{result.skills.length - 3}</Badge>
					{/if}
				</div>
			{/if}
		</CardContent>
	</Card>
</a>
