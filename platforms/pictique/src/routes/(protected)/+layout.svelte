<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { BottomNav, SideBar } from '$lib/fragments';
	import CreatePostModal from '$lib/fragments/CreatePostModal/CreatePostModal.svelte';
	import { closeDisclaimerModal, isDisclaimerModalOpen } from '$lib/stores/disclaimer';
	import { isCreatePostModalOpen, openCreatePostModal } from '$lib/stores/posts';
	import type { userProfile } from '$lib/types';
	import { Button, Modal } from '$lib/ui';
	import { apiClient, getAuthId, getAuthToken } from '$lib/utils';
	import { removeAuthId, removeAuthToken } from '$lib/utils';
	import type { AxiosError } from 'axios';
	import { onMount } from 'svelte';

	let { children } = $props();
	let ownerId: string | null = $state(null);
	let route = $derived(page.url.pathname);

	let profile = $state<userProfile | null>(null);
	let confirmedDisclaimer = $state(false);

	async function fetchProfile() {
		ownerId = getAuthId();
		try {
			if (!getAuthToken()) {
				goto('/auth');
			}
			const response = await apiClient.get(`/api/users/${ownerId}`).catch((e: AxiosError) => {
				if (e.response?.status === 401) {
					goto('/auth');
				}
			});
			if (!response) return;
			profile = response.data;
		} catch (err) {
			console.log(err instanceof Error ? err.message : 'Failed to load profile');
		}
	}

	onMount(fetchProfile);
</script>

<main class="block h-dvh grid-cols-[20vw_1fr] md:grid">
	<SideBar
		profileSrc={profile?.avatarUrl || '/images/user.png'}
		handlePost={async () => {
			openCreatePostModal();
		}}
	/>
	{@render children()}

	{#if route !== `/messages/${page.params.id}`}
		<BottomNav class="btm-nav" profileSrc={profile?.avatarUrl ?? ''} />
	{/if}
</main>

<CreatePostModal bind:open={$isCreatePostModalOpen} />
<Modal
	open={$isDisclaimerModalOpen}
	onclose={() => {
		if (!confirmedDisclaimer) {
			removeAuthToken();
			removeAuthId();
			goto('/auth');
		}
	}}
>
	<article class="flex max-w-[400px] flex-col gap-2 p-4">
		<h1>Disclaimer from MetaState Foundation</h1>
		<p class="font-bold">⚠️ Please note:</p>
		<p>
			Pictique is a <b>functional prototype</b>, intended to showcase <b>interoperability</b> and
			core concepts of the W3DS ecosystem.
		</p>
		<p>
			<b>It is not a production-grade platform</b> and may lack full reliability, performance, and
			security guarantees.
		</p>
		<p>
			We <b>strongly recommend</b> that you avoid sharing <b>sensitive or private content</b>,
			and kindly ask for your understanding regarding any bugs, incomplete features, or
			unexpected behaviours.
		</p>
		<p>
			The app is still in development, so we kindly ask for your understanding regarding any
			potential issues. If you experience issues or have feedback, feel free to contact us at:
		</p>
		<a href="mailto:info@metastate.foundation" class="font-bold outline-none">
			info@metastate.foundation
		</a>
		<Button
			variant="secondary"
			size="sm"
			class="mt-2"
			callback={() => {
				closeDisclaimerModal();
				confirmedDisclaimer = true;
			}}>I Understand</Button
		>
	</article>
</Modal>
