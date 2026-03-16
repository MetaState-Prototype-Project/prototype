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
	<Card class="transition-shadow hover:shadow-md">
		<CardContent class="pt-6">
			<div class="flex items-start gap-4">
				<Avatar class="h-14 w-14">
					{#if avatarProxyUrl()}
						<AvatarImage src={avatarProxyUrl()} alt={result.name} />
					{/if}
					<AvatarFallback class="text-lg font-bold">
						{(result.name || result.ename || '?')[0]?.toUpperCase()}
					</AvatarFallback>
				</Avatar>

				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-1.5">
						<h3 class="truncate text-sm font-semibold text-foreground">{result.name || result.ename}</h3>
						{#if result.isVerified}
							<Badge variant="default" class="text-[10px] px-1.5 py-0">Verified</Badge>
						{/if}
					</div>
					{#if result.headline}
						<p class="mt-0.5 truncate text-sm text-muted-foreground">{result.headline}</p>
					{/if}
					{#if result.location}
						<p class="mt-0.5 text-xs text-muted-foreground/60">{result.location}</p>
					{/if}
					{#if result.skills?.length}
						<div class="mt-2 flex flex-wrap gap-1">
							{#each result.skills.slice(0, 4) as skill}
								<Badge variant="secondary" class="text-xs">{skill}</Badge>
							{/each}
							{#if result.skills.length > 4}
								<Badge variant="outline" class="text-xs">+{result.skills.length - 4}</Badge>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</CardContent>
	</Card>
</a>
