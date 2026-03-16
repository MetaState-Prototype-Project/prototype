<script lang="ts">
	import { untrack } from 'svelte';
	import { profile, profileLoading, fetchProfile, updateProfile } from '$lib/stores/profile';
	import { currentUser } from '$lib/stores/auth';
	import { toast } from 'svelte-sonner';
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@metastate-foundation/ui/card';
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
</script>

<svelte:head>
	<title>My Profile - Profile Editor</title>
</svelte:head>

{#if $profileLoading && !$profile}
	<div class="mx-auto max-w-3xl space-y-6">
		<Skeleton class="h-48 w-full rounded-xl" />
		<Skeleton class="h-32 w-full rounded-xl" />
		<Skeleton class="h-32 w-full rounded-xl" />
	</div>
{:else if $profile}
	<div class="mx-auto max-w-3xl space-y-6">
		<ProfileHeader profile={$profile} editable={true} />
		<AboutSection bio={$profile.professional.bio ?? ''} editable={true} />
		<ExperienceSection entries={$profile.professional.workExperience ?? []} editable={true} />
		<EducationSection entries={$profile.professional.education ?? []} editable={true} />
		<SkillsSection skills={$profile.professional.skills ?? []} editable={true} />
		<ContactSection
			email={$profile.professional.email ?? ''}
			phone={$profile.professional.phone ?? ''}
			website={$profile.professional.website ?? ''}
			editable={true}
		/>
		<SocialLinksSection links={$profile.professional.socialLinks ?? []} editable={true} />
		<DocumentsSection
			ename={$profile.ename}
			cvFileId={$profile.professional.cvFileId}
			videoIntroFileId={$profile.professional.videoIntroFileId}
			editable={true}
		/>

		<!-- Privacy toggle -->
		<Card>
			<CardHeader>
				<CardTitle>Profile Visibility</CardTitle>
				<CardDescription>
					{$profile.professional.isPublic !== false
						? 'Your profile is visible to everyone in the W3DS ecosystem.'
						: 'Your profile is private and hidden from discovery.'}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Button
					variant={$profile.professional.isPublic !== false ? 'default' : 'outline'}
					onclick={async () => {
						const newValue = $profile?.professional.isPublic === false;
						try {
							await updateProfile({ isPublic: newValue });
							toast.success(newValue ? 'Profile is now public' : 'Profile is now private');
						} catch {
							toast.error('Failed to update visibility');
						}
					}}
				>
					{$profile.professional.isPublic !== false ? 'Public — Click to make private' : 'Private — Click to make public'}
				</Button>
			</CardContent>
		</Card>
	</div>
{:else}
	<div class="flex flex-col items-center justify-center py-20 text-center">
		<p class="text-muted-foreground">Unable to load your profile.</p>
		<Button variant="link" onclick={() => fetchProfile()}>Try again</Button>
	</div>
{/if}
