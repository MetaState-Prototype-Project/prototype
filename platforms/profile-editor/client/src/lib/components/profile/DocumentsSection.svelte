<script lang="ts">
	import { updateProfile } from '$lib/stores/profile';
	import { uploadFile, getProfileAssetUrl } from '$lib/utils/file-manager';
	import { toast } from 'svelte-sonner';
	import { Card, CardContent, CardHeader, CardTitle } from '@metastate-foundation/ui/card';
	import { Button } from '@metastate-foundation/ui/button';
	import { Progress } from '@metastate-foundation/ui/progress';

	let { ename, cvFileId, videoIntroFileId, editable = false }: { ename: string; cvFileId?: string; videoIntroFileId?: string; editable?: boolean } = $props();

	let uploadingCv = $state(false);
	let uploadingVideo = $state(false);
	let cvProgress = $state(0);
	let videoProgress = $state(0);
	let cvInput = $state<HTMLInputElement | null>(null);
	let videoInput = $state<HTMLInputElement | null>(null);

	async function handleCvUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		uploadingCv = true;
		cvProgress = 0;
		try {
			const result = await uploadFile(file, (p) => { cvProgress = p; });
			await updateProfile({ cvFileId: result.id });
			toast.success('CV uploaded');
		} catch {
			toast.error('Failed to upload CV');
		} finally {
			uploadingCv = false;
		}
	}

	async function handleVideoUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		uploadingVideo = true;
		videoProgress = 0;
		try {
			const result = await uploadFile(file, (p) => { videoProgress = p; });
			await updateProfile({ videoIntroFileId: result.id });
			toast.success('Video introduction uploaded');
		} catch {
			toast.error('Failed to upload video');
		} finally {
			uploadingVideo = false;
		}
	}

	async function removeCv() {
		try {
			await updateProfile({ cvFileId: '' });
			toast.success('CV removed');
		} catch {
			toast.error('Failed to remove CV');
		}
	}

	async function removeVideo() {
		try {
			await updateProfile({ videoIntroFileId: '' });
			toast.success('Video removed');
		} catch {
			toast.error('Failed to remove video');
		}
	}
</script>

<Card>
	<CardHeader>
		<CardTitle>Documents</CardTitle>
	</CardHeader>

	<CardContent>
		<div class="grid gap-4 sm:grid-cols-2">
			<!-- CV -->
			<Card class="bg-muted/30">
				<CardContent class="pt-6">
					<div class="flex items-center gap-2 mb-3">
						<svg class="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
						</svg>
						<h3 class="text-sm font-medium text-foreground">CV / Resume</h3>
					</div>

					{#if cvFileId}
						<div class="flex items-center gap-2">
							<Button variant="link" size="sm" href={getProfileAssetUrl(ename, 'cv')} class="h-auto p-0">Download CV</Button>
							{#if editable}
								<Button variant="link" size="sm" class="h-auto p-0 text-destructive" onclick={removeCv}>Remove</Button>
							{/if}
						</div>
					{:else if editable}
						{#if uploadingCv}
							<div class="flex items-center gap-2">
								<Progress value={cvProgress} class="flex-1" />
								<span class="text-xs text-muted-foreground">{cvProgress}%</span>
							</div>
						{:else}
							<Button variant="outline" size="sm" onclick={() => cvInput?.click()}>Upload CV</Button>
							<input bind:this={cvInput} type="file" accept=".pdf,.doc,.docx" class="hidden" onchange={handleCvUpload} />
						{/if}
					{:else}
						<p class="text-xs text-muted-foreground/50">No CV uploaded</p>
					{/if}
				</CardContent>
			</Card>

			<!-- Video Introduction -->
			<Card class="bg-muted/30">
				<CardContent class="pt-6">
					<div class="flex items-center gap-2 mb-3">
						<svg class="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
						</svg>
						<h3 class="text-sm font-medium text-foreground">Video Introduction</h3>
					</div>

					{#if videoIntroFileId}
						<div class="flex items-center gap-2">
							<Button variant="link" size="sm" href={getProfileAssetUrl(ename, 'video')} class="h-auto p-0">View Video</Button>
							{#if editable}
								<Button variant="link" size="sm" class="h-auto p-0 text-destructive" onclick={removeVideo}>Remove</Button>
							{/if}
						</div>
					{:else if editable}
						{#if uploadingVideo}
							<div class="flex items-center gap-2">
								<Progress value={videoProgress} class="flex-1" />
								<span class="text-xs text-muted-foreground">{videoProgress}%</span>
							</div>
						{:else}
							<Button variant="outline" size="sm" onclick={() => videoInput?.click()}>Upload Video</Button>
							<input bind:this={videoInput} type="file" accept="video/*" class="hidden" onchange={handleVideoUpload} />
						{/if}
					{:else}
						<p class="text-xs text-muted-foreground/50">No video uploaded</p>
					{/if}
				</CardContent>
			</Card>
		</div>
	</CardContent>
</Card>
