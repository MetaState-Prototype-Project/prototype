<script lang="ts">
	import { goto } from '$app/navigation';
	import { currentUser, logout } from '$lib/stores/auth';
	import { Button } from '@metastate-foundation/ui/button';
	import { Separator } from '@metastate-foundation/ui/separator';
</script>

<header class="flex h-16 items-center justify-between bg-card px-6">
	<div class="flex items-center gap-4 lg:hidden">
		<span class="text-lg font-semibold text-foreground">Profile Editor</span>
	</div>
	<div class="hidden lg:block"></div>

	<div class="flex items-center gap-4">
		{#if $currentUser}
			<span class="text-sm text-muted-foreground">{$currentUser.name ?? $currentUser.ename}</span>
		{/if}
		<Button
			variant="ghost"
			size="sm"
			onclick={() => { logout(); goto('/auth'); }}
		>
			Sign out
		</Button>
	</div>
</header>
<Separator />
