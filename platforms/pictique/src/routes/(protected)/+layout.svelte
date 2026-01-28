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
	import type { AxiosError } from 'axios';
	import { onMount } from 'svelte';

	let { children } = $props();
	let ownerId: string | null = $state(null);
	let route = $derived(page.url.pathname);

	let profile = $state<userProfile | null>(null);
	let confirmedDisclaimer = $state(false);
	let showHint = $state(false);

	const DISCLAIMER_KEY = 'pictique-disclaimer-accepted';

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

	onMount(() => {
		fetchProfile();
		const accepted = localStorage.getItem(DISCLAIMER_KEY) === 'true';
		if (accepted) {
			confirmedDisclaimer = true;
			closeDisclaimerModal();
		}
	});
</script>

<main class="block h-dvh grid-cols-[20vw_1fr] md:grid">
	<SideBar
		profileSrc={profile?.avatarUrl || '/images/user.png'}
		handlePost={async () => {
			openCreatePostModal();
		}}
	/>
	{@render children()}

	{#if !route.match(/^\/messages\/[^/]+$/)}
		<BottomNav class="btm-nav" profileSrc={profile?.avatarUrl ?? ''} />
	{/if}
</main>

<CreatePostModal bind:open={$isCreatePostModalOpen} />
<Modal
	open={$isDisclaimerModalOpen}
	onClickOutside={(modal) => {
		if (!confirmedDisclaimer) {
			showHint = true;
			modal.animate(
				[
					{ transform: 'scale(1)' },
					{ transform: 'scale(1.025)' },
					{ transform: 'scale(1)' },
					{ transform: 'scale(1.0125)' },
					{ transform: 'scale(1)' }
				],
				{
					duration: 250,
					easing: 'ease-in-out'
				}
			);
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
			class="mt-2 w-full"
			data-disclaimer-button
			callback={() => {
				localStorage.setItem(DISCLAIMER_KEY, 'true');
				closeDisclaimerModal();
				confirmedDisclaimer = true;
			}}>I Understand</Button
		>
		{#if showHint}
			<p
				class="mt-2 rounded-md border border-red-300 bg-red-100 px-3 py-2 text-center text-xs text-red-800"
			>
				💡 You must accept the disclaimer to continue. This will only appear once.
			</p>
		{/if}
	</article>
</Modal>
