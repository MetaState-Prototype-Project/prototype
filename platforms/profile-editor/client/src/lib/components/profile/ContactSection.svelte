<script lang="ts">
	import { updateProfile } from '$lib/stores/profile';
	import { toast } from 'svelte-sonner';
	import { Card, CardContent, CardHeader, CardTitle } from '@metastate-foundation/ui/card';
	import { Button } from '@metastate-foundation/ui/button';
	import { Input } from '@metastate-foundation/ui/input';
	import { Label } from '@metastate-foundation/ui/label';

	let { email = '', phone = '', website = '', editable = false }: { email?: string; phone?: string; website?: string; editable?: boolean } = $props();

	let editing = $state(false);
	let editEmail = $state(email);
	let editPhone = $state(phone);
	let editWebsite = $state(website);

	async function save() {
		try {
			await updateProfile({ email: editEmail, phone: editPhone, website: editWebsite });
			editing = false;
			toast.success('Contact info updated');
		} catch {
			toast.error('Failed to update contact info');
		}
	}
</script>

<Card>
	<CardHeader>
		<div class="flex items-center justify-between">
			<CardTitle>Contact</CardTitle>
			{#if editable && !editing}
				<Button variant="ghost" size="sm" onclick={() => { editing = true; editEmail = email; editPhone = phone; editWebsite = website; }}>Edit</Button>
			{/if}
		</div>
	</CardHeader>

	<CardContent>
		{#if editing}
			<div class="grid gap-3">
				<div class="space-y-1">
					<Label>Email</Label>
					<Input bind:value={editEmail} type="email" placeholder="email@example.com" />
				</div>
				<div class="space-y-1">
					<Label>Phone</Label>
					<Input bind:value={editPhone} type="tel" placeholder="+1 234 567 890" />
				</div>
				<div class="space-y-1">
					<Label>Website</Label>
					<Input bind:value={editWebsite} type="url" placeholder="https://example.com" />
				</div>
				<div class="flex gap-2">
					<Button size="sm" onclick={save}>Save</Button>
					<Button variant="outline" size="sm" onclick={() => { editing = false; }}>Cancel</Button>
				</div>
			</div>
		{:else}
			<div class="space-y-2">
				{#if email}
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<svg class="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
						<a href="mailto:{email}" class="hover:underline">{email}</a>
					</div>
				{/if}
				{#if phone}
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<svg class="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
						<span>{phone}</span>
					</div>
				{/if}
				{#if website}
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<svg class="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
						<a href={website} target="_blank" rel="noopener" class="hover:underline">{website}</a>
					</div>
				{/if}
				{#if !email && !phone && !website}
					<p class="text-sm italic text-muted-foreground/50">{editable ? 'Add your contact info' : 'No contact info'}</p>
				{/if}
			</div>
		{/if}
	</CardContent>
</Card>
