<script lang="ts">
	import { updateSkills } from '$lib/stores/profile';
	import { toast } from 'svelte-sonner';
	import { Card, CardContent, CardHeader, CardTitle } from '@metastate-foundation/ui/card';
	import { Button } from '@metastate-foundation/ui/button';
	import { Input } from '@metastate-foundation/ui/input';
	import { Badge } from '@metastate-foundation/ui/badge';

	let { skills = [], editable = false }: { skills?: string[]; editable?: boolean } = $props();

	let newSkill = $state('');

	async function addSkill() {
		const trimmed = newSkill.trim();
		if (!trimmed || skills.includes(trimmed)) return;

		try {
			await updateSkills([...skills, trimmed]);
			newSkill = '';
			toast.success('Skill added');
		} catch {
			toast.error('Failed to add skill');
		}
	}

	async function removeSkill(index: number) {
		try {
			await updateSkills(skills.filter((_, i) => i !== index));
			toast.success('Skill removed');
		} catch {
			toast.error('Failed to remove skill');
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addSkill();
		}
	}
</script>

<Card>
	<CardHeader>
		<CardTitle>Skills</CardTitle>
	</CardHeader>

	<CardContent>
		<div class="flex flex-wrap gap-2">
			{#each skills as skill, i}
				<Badge variant="secondary" class="gap-1">
					{skill}
					{#if editable}
						<button onclick={() => removeSkill(i)} class="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive">
							<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
						</button>
					{/if}
				</Badge>
			{:else}
				{#if !editable}
					<p class="text-sm italic text-muted-foreground/50">No skills listed</p>
				{/if}
			{/each}
		</div>

		{#if editable}
			<div class="mt-3 flex gap-2">
				<Input bind:value={newSkill} onkeydown={handleKeydown} placeholder="Add a skill..." class="flex-1" />
				<Button size="sm" onclick={addSkill}>Add</Button>
			</div>
		{/if}
	</CardContent>
</Card>
