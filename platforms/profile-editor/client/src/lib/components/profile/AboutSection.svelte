<script lang="ts">
	import { updateProfile } from '$lib/stores/profile';
	import { toast } from 'svelte-sonner';
	import { Card, CardContent, CardHeader, CardTitle } from '@metastate-foundation/ui/card';
	import { Button } from '@metastate-foundation/ui/button';
	import { Textarea } from '@metastate-foundation/ui/textarea';

	let { bio = '', editable = false }: { bio?: string; editable?: boolean } = $props();

	let editing = $state(false);
	let editBio = $state(bio);

	async function save() {
		try {
			await updateProfile({ bio: editBio });
			editing = false;
			toast.success('Bio updated');
		} catch {
			toast.error('Failed to update bio');
		}
	}
</script>

<Card>
	<CardHeader>
		<div class="flex items-center justify-between">
			<CardTitle>About</CardTitle>
			{#if editable && !editing}
				<Button variant="ghost" size="sm" onclick={() => { editing = true; editBio = bio; }}>Edit</Button>
			{/if}
		</div>
	</CardHeader>

	<CardContent>
		{#if editing}
			<div class="flex flex-col gap-3">
				<Textarea bind:value={editBio} rows={5} placeholder="Tell people about yourself..." />
				<div class="flex gap-2">
					<Button size="sm" onclick={save}>Save</Button>
					<Button variant="outline" size="sm" onclick={() => { editing = false; }}>Cancel</Button>
				</div>
			</div>
		{:else if bio}
			<p class="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{bio}</p>
		{:else if editable}
			<p class="text-sm italic text-muted-foreground/50">No bio yet. Click edit to add one.</p>
		{/if}
	</CardContent>
</Card>
