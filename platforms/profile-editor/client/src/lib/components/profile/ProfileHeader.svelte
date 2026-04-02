<script lang="ts">
	import type { ProfileData } from '$lib/stores/profile';
	import { updateProfile } from '$lib/stores/profile';
	import { uploadFile, getProfileAssetUrl } from '$lib/utils/file-manager';
	import { toast } from 'svelte-sonner';
	import { Card, CardContent } from '@metastate-foundation/ui/card';
	import { Button } from '@metastate-foundation/ui/button';
	import { Input } from '@metastate-foundation/ui/input';
	import { Avatar, AvatarImage, AvatarFallback } from '@metastate-foundation/ui/avatar';
	import { Badge } from '@metastate-foundation/ui/badge';

	let { profile, editable = false }: { profile: ProfileData; editable?: boolean } = $props();

	let editingBasic = $state(false);
	let displayName = $state(profile.name ?? profile.professional.displayName ?? '');
	let headline = $state(profile.professional.headline ?? '');
	let location = $state(profile.professional.location ?? '');
	let uploadingAvatar = $state(false);
	let uploadingBanner = $state(false);
	let bannerInput = $state<HTMLInputElement | null>(null);
	let avatarInput = $state<HTMLInputElement | null>(null);
	/** Local blob previews — shown instantly before upload completes */
	let avatarPreview = $state<string | null>(null);
	let bannerPreview = $state<string | null>(null);
	/** Cache-bust counters — incremented after successful upload */
	let avatarCacheBust = $state(0);
	let bannerCacheBust = $state(0);

	function avatarSrc(): string | null {
		if (avatarPreview) return avatarPreview;
		if (profile.professional.avatarFileId) {
			// Use cacheBust to force re-read; also needed on initial load
			void avatarCacheBust;
			return getProfileAssetUrl(profile.ename, 'avatar', avatarCacheBust > 0);
		}
		return null;
	}

	function bannerSrc(): string | null {
		if (bannerPreview) return bannerPreview;
		if (profile.professional.bannerFileId) {
			void bannerCacheBust;
			return getProfileAssetUrl(profile.ename, 'banner', bannerCacheBust > 0);
		}
		return null;
	}

	async function handleAvatarUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		// Show local preview instantly
		avatarPreview = URL.createObjectURL(file);

		uploadingAvatar = true;
		try {
			const result = await uploadFile(file);
			await updateProfile({ avatarFileId: result.id });
			avatarPreview = null;
			avatarCacheBust++;
			toast.success('Avatar updated');
		} catch {
			toast.error('Failed to upload avatar');
			avatarPreview = null;
		} finally {
			uploadingAvatar = false;
		}
	}

	async function handleBannerUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		// Show local preview instantly
		bannerPreview = URL.createObjectURL(file);

		uploadingBanner = true;
		try {
			const result = await uploadFile(file);
			await updateProfile({ bannerFileId: result.id });
			bannerPreview = null;
			bannerCacheBust++;
			toast.success('Banner updated');
		} catch {
			toast.error('Failed to upload banner');
			bannerPreview = null;
		} finally {
			uploadingBanner = false;
		}
	}

	async function saveBasicInfo() {
		try {
			await updateProfile({ displayName, headline, location });
			editingBasic = false;
			toast.success('Profile updated');
		} catch {
			toast.error('Failed to update profile');
		}
	}
</script>

<Card class="overflow-hidden p-0">
	<!-- Banner -->
	<div class="relative h-48 bg-gradient-to-r from-primary/20 to-primary/5">
		{#if bannerSrc()}
			<img src={bannerSrc()} alt="Banner" class="h-full w-full object-cover" />
		{/if}
		{#if editable}
			<div class="absolute bottom-3 right-3">
				<Button variant="secondary" size="sm" onclick={() => bannerInput?.click()} disabled={uploadingBanner}>
					{uploadingBanner ? 'Uploading...' : 'Change Banner'}
				</Button>
				<input bind:this={bannerInput} type="file" accept="image/*" class="hidden" onchange={handleBannerUpload} />
			</div>
		{/if}
	</div>

	<!-- Avatar + Info -->
	<CardContent class="relative pb-6">
		<div class="flex flex-col items-start gap-4 sm:flex-row sm:items-end">
			<!-- Avatar -->
			<div class="-mt-16 relative">
				<Avatar class="h-32 w-32 border-4 border-card">
					{#if avatarSrc()}
						<AvatarImage src={avatarSrc()} alt={profile.name ?? profile.ename} />
					{/if}
					<AvatarFallback class="text-3xl font-bold">
						{(profile.name ?? profile.ename ?? '?')[0]?.toUpperCase()}
					</AvatarFallback>
				</Avatar>
				{#if editable}
					<div class="absolute bottom-1 right-1">
						<Button size="icon-sm" class="rounded-full" onclick={() => avatarInput?.click()} disabled={uploadingAvatar}>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
							</svg>
						</Button>
						<input bind:this={avatarInput} type="file" accept="image/*" class="hidden" onchange={handleAvatarUpload} />
					</div>
				{/if}
			</div>

			<!-- Name and headline -->
			<div class="flex-1 pt-2 sm:pt-0">
				<div class="flex items-center gap-2">
					<h1 class="text-2xl font-bold text-foreground">{profile.name ?? profile.ename}</h1>
					{#if profile.isVerified}
						<Badge variant="default" class="text-xs">Verified</Badge>
					{/if}
				</div>

				{#if editingBasic}
					<div class="mt-2 flex flex-col gap-2">
						<Input bind:value={displayName} placeholder="Your name" />
						<Input bind:value={headline} placeholder="Professional headline" />
						<Input bind:value={location} placeholder="Location" />
						<div class="flex gap-2">
							<Button size="sm" onclick={saveBasicInfo}>Save</Button>
							<Button variant="outline" size="sm" onclick={() => { editingBasic = false; }}>Cancel</Button>
						</div>
					</div>
				{:else}
					{#if profile.professional.headline}
						<p class="mt-1 text-base text-muted-foreground">{profile.professional.headline}</p>
					{/if}
					{#if profile.professional.location}
						<p class="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
							</svg>
							{profile.professional.location}
						</p>
					{/if}
					{#if editable}
						<Button variant="link" size="sm" class="mt-1 h-auto p-0" onclick={() => { editingBasic = true; displayName = profile.name ?? profile.professional.displayName ?? ''; headline = profile.professional.headline ?? ''; location = profile.professional.location ?? ''; }}>
							Edit name, headline & location
						</Button>
					{/if}
				{/if}

				<p class="mt-1 text-sm text-muted-foreground/60">{profile.ename}</p>
			</div>
		</div>
	</CardContent>
</Card>
