<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { fetchPublicProfile, type ProfileData } from '$lib/stores/profile';
	import { currentUser } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Button } from '@metastate-foundation/ui/button';
	import { Skeleton } from '@metastate-foundation/ui/skeleton';
	import ProfileHeader from '$lib/components/profile/ProfileHeader.svelte';
	import AboutSection from '$lib/components/profile/AboutSection.svelte';
	import ExperienceSection from '$lib/components/profile/ExperienceSection.svelte';
	import EducationSection from '$lib/components/profile/EducationSection.svelte';
	import SkillsSection from '$lib/components/profile/SkillsSection.svelte';
	import ContactSection from '$lib/components/profile/ContactSection.svelte';
	import SocialLinksSection from '$lib/components/profile/SocialLinksSection.svelte';
	import DocumentsSection from '$lib/components/profile/DocumentsSection.svelte';

	let viewProfile = $state<ProfileData | null>(null);
	let loading = $state(true);
	let errorMsg = $state<string | null>(null);

	onMount(async () => {
		const ename = $page.params.ename;

		if (!ename) {
			errorMsg = 'Invalid profile URL.';
			loading = false;
			return;
		}

		if ($currentUser?.ename === ename) {
			goto('/profile');
			return;
		}

		try {
			viewProfile = await fetchPublicProfile(ename);
		} catch (error: any) {
			if (error?.response?.status === 403) {
				errorMsg = 'This profile is private.';
			} else {
				errorMsg = 'Unable to load this profile.';
				toast.error('Failed to load profile');
			}
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>{viewProfile?.name ?? $page.params.ename} - Profile Editor</title>
</svelte:head>

{#if loading}
	<div class="mx-auto max-w-3xl space-y-6">
		<Skeleton class="h-48 w-full rounded-xl" />
		<Skeleton class="h-32 w-full rounded-xl" />
		<Skeleton class="h-32 w-full rounded-xl" />
	</div>
{:else if errorMsg}
	<div class="flex flex-col items-center justify-center py-20 text-center">
		<svg class="mb-4 h-16 w-16 text-muted-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
		</svg>
		<p class="text-lg font-medium text-foreground">{errorMsg}</p>
		<Button variant="link" href="/discover">Back to discover</Button>
	</div>
{:else if viewProfile}
	<div class="mx-auto max-w-3xl space-y-6">
		<ProfileHeader profile={viewProfile} editable={false} />
		{#if viewProfile.professional.bio}
			<AboutSection bio={viewProfile.professional.bio} editable={false} />
		{/if}
		{#if viewProfile.professional.workExperience?.length}
			<ExperienceSection entries={viewProfile.professional.workExperience} editable={false} />
		{/if}
		{#if viewProfile.professional.education?.length}
			<EducationSection entries={viewProfile.professional.education} editable={false} />
		{/if}
		{#if viewProfile.professional.skills?.length}
			<SkillsSection skills={viewProfile.professional.skills} editable={false} />
		{/if}
		{#if viewProfile.professional.email || viewProfile.professional.phone || viewProfile.professional.website}
			<ContactSection
				email={viewProfile.professional.email ?? ''}
				phone={viewProfile.professional.phone ?? ''}
				website={viewProfile.professional.website ?? ''}
				editable={false}
			/>
		{/if}
		{#if viewProfile.professional.socialLinks?.length}
			<SocialLinksSection links={viewProfile.professional.socialLinks} editable={false} />
		{/if}
		{#if viewProfile.professional.cvFileId || viewProfile.professional.videoIntroFileId}
			<DocumentsSection
				ename={viewProfile.ename}
				cvFileId={viewProfile.professional.cvFileId}
				videoIntroFileId={viewProfile.professional.videoIntroFileId}
				editable={false}
			/>
		{/if}
	</div>
{/if}
