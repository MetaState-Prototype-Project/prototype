<script lang="ts">
	import { untrack } from 'svelte';
	import { profile, fetchProfile, updateProfile } from '$lib/stores/profile';
	import { logout, currentUser } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@metastate-foundation/ui/card';
	import { Button } from '@metastate-foundation/ui/button';
	import { Input } from '@metastate-foundation/ui/input';
	import { Separator } from '@metastate-foundation/ui/separator';

	let editingName = $state(false);
	let nameValue = $state('');

	let lastFetchedEname = '';

	$effect(() => {
		const ename = $currentUser?.ename;
		if (ename && ename !== lastFetchedEname) {
			lastFetchedEname = ename;
			untrack(() => {
				fetchProfile().catch(() => {
					toast.error('Failed to load profile');
				});
			});
		}
	});

	async function saveName() {
		try {
			await updateProfile({ displayName: nameValue });
			editingName = false;
			toast.success('Name updated');
		} catch {
			toast.error('Failed to update name');
		}
	}
</script>

<svelte:head>
	<title>Settings - Profile Editor</title>
</svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-foreground">Settings</h1>
		<p class="mt-1 text-sm text-muted-foreground">Manage your account preferences</p>
	</div>

	<!-- Account info -->
	<Card>
		<CardHeader>
			<CardTitle>Account</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="space-y-3">
				<div>
					<p class="text-xs font-medium text-muted-foreground">eID Name</p>
					<p class="text-sm text-foreground">{$currentUser?.ename ?? '—'}</p>
				</div>
				<Separator />
				<div>
					<p class="text-xs font-medium text-muted-foreground">Name</p>
					{#if editingName}
						<div class="mt-1 flex gap-2">
							<Input
								bind:value={nameValue}
								placeholder="Enter your display name"
								class="flex-1"
							/>
							<Button size="sm" onclick={saveName}>Save</Button>
							<Button variant="outline" size="sm" onclick={() => { editingName = false; }}>Cancel</Button>
						</div>
					{:else}
						<p class="text-sm text-foreground">{$profile?.name ?? '—'}</p>
						<Button variant="link" size="sm" class="mt-1 h-auto p-0 text-xs" onclick={() => { editingName = true; nameValue = $profile?.name ?? ''; }}>
							{$profile?.name ? 'Edit' : 'Add your name'}
						</Button>
					{/if}
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Profile visibility -->
	{#if $profile}
		<Card>
			<CardHeader>
				<CardTitle>Privacy</CardTitle>
				<CardDescription>Control who can see your profile</CardDescription>
			</CardHeader>
			<CardContent>
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-foreground">Public profile</p>
						<p class="text-xs text-muted-foreground">
							When enabled, your profile is discoverable by other users
						</p>
					</div>
					<Button
						variant={$profile.professional.isPublic !== false ? 'default' : 'outline'}
						size="sm"
						onclick={async () => {
							const newValue = $profile?.professional.isPublic === false;
							// Flip UI instantly
							profile.update(p => p ? { ...p, professional: { ...p.professional, isPublic: newValue } } : p);
							toast.success(newValue ? 'Profile is now public' : 'Profile is now private');
							try {
								await updateProfile({ isPublic: newValue });
							} catch {
								// Revert on failure
								profile.update(p => p ? { ...p, professional: { ...p.professional, isPublic: !newValue } } : p);
								toast.error('Failed to update visibility');
							}
						}}
					>
						{$profile.professional.isPublic !== false ? 'Public' : 'Private'}
					</Button>
				</div>
			</CardContent>
		</Card>
	{/if}

	<!-- Sign out -->
	<Card>
		<CardHeader>
			<CardTitle>Session</CardTitle>
		</CardHeader>
		<CardContent>
			<Button
				variant="destructive"
				onclick={() => { logout(); goto('/auth'); }}
			>
				Sign out
			</Button>
		</CardContent>
	</Card>
</div>
