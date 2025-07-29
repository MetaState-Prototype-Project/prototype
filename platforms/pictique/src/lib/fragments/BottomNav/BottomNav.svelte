<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Camera, CommentsTwo, Home, Search } from '$lib/icons';
	import { isNavigatingThroughNav } from '$lib/store/store.svelte';
	import { uploadedImages } from '$lib/store/store.svelte';
	import { getAuthId, revokeImageUrls } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	interface IBottomNavProps extends HTMLAttributes<HTMLElement> {
		activeTab?: string;
		profileSrc: string;
	}
	let {
		activeTab = $bindable('home'),
		profileSrc = 'https://picsum.photos/200'
	}: IBottomNavProps = $props();

	const tabs = ['home', 'discover', 'post', 'messages', 'profile', 'settings'];
	let ownerId: string | null = $derived(getAuthId());
	let previousTab = $state('home');
	let _activeTab = $derived(page.url.pathname);
	let fullPath = $derived(page.url.pathname);

	let imageInput: HTMLInputElement;
	let images: FileList | null = $state(null);

	const handleNavClick = (newTab: string) => {
		// activeTab = newTab;
		isNavigatingThroughNav.value = true;
		const fromIndex = tabs.indexOf(previousTab);
		const toIndex = tabs.indexOf(newTab);
		const direction = toIndex > fromIndex ? 'right' : 'left';
		document.documentElement.setAttribute('data-transition', direction);
		previousTab = newTab;
		if (newTab === 'profile') {
			goto(`/profile/${ownerId}`);
		} else if (newTab === 'post') {
			uploadedImages.value = null;
			imageInput.value = '';
			imageInput.click();
		} else {
			goto(`/${newTab}`);
		}
	};

	$effect(() => {
		activeTab = _activeTab.split('/').pop() ?? '';
		if (
			images &&
			images.length > 0 &&
			activeTab !== 'post' &&
			previousTab === 'post' &&
			!_activeTab.includes('post/audience')
		) {
			if (uploadedImages.value) revokeImageUrls(uploadedImages.value);
			uploadedImages.value = Array.from(images).map((file) => ({
				url: URL.createObjectURL(file),
				alt: file.name
			}));
			images = null; // To prevent re-triggering the effect and thus making an infinite loop with /post route's effect when the length of uploadedImages goes to 0
			if (uploadedImages.value.length > 0) {
				goto('/post');
			}
		}
	});
</script>

<input
	type="file"
	accept="image/*"
	multiple
	bind:files={images}
	bind:this={imageInput}
	class="hidden"
/>
<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<nav
	aria-label="Main navigation"
	class="border-grey fixed start-0 bottom-0 flex w-full items-center justify-between border-t-[1px] bg-white px-7 py-2 md:hidden"
	role="tablist"
>
	<button
		type="button"
		class="flex flex-col items-center"
		aria-current={activeTab === 'home' ? 'page' : undefined}
		onclick={() => handleNavClick('home')}
	>
		<Home
			size="24px"
			color={activeTab === 'home'
				? 'var(--color-brand-burnt-orange)'
				: 'var(--color-black-400)'}
			fill={activeTab === 'home' ? 'var(--color-brand-burnt-orange-300)' : 'white'}
		/>
	</button>

	<button
		type="button"
		class="flex flex-col items-center"
		aria-current={activeTab === 'discover' ? 'page' : undefined}
		onclick={() => handleNavClick('discover')}
	>
		<Search
			size="24px"
			color={activeTab === 'discover'
				? 'var(--color-brand-burnt-orange)'
				: 'var(--color-black-400)'}
			fill={activeTab === 'discover' ? 'var(--color-brand-burnt-orange-300)' : 'white'}
		/>
	</button>

	<button
		type="button"
		class="flex flex-col items-center"
		aria-current={activeTab === 'post' ? 'page' : undefined}
		onclick={() => handleNavClick('post')}
	>
		<Camera
			size="24px"
			color={activeTab === 'post'
				? 'var(--color-brand-burnt-orange)'
				: 'var(--color-black-400)'}
			fill={activeTab === 'post' ? 'var(--color-brand-burnt-orange-300)' : 'white'}
		/>
	</button>

	<button
		type="button"
		class="flex flex-col items-center"
		aria-current={activeTab === 'messages' ? 'page' : undefined}
		onclick={() => handleNavClick('messages')}
	>
		<CommentsTwo
			size="24px"
			color={activeTab === 'messages'
				? 'var(--color-brand-burnt-orange)'
				: 'var(--color-black-400)'}
			fill={activeTab === 'messages' ? 'var(--color-brand-burnt-orange-300)' : 'white'}
		/>
	</button>

	<button
		type="button"
		class="flex flex-col items-center"
		aria-current={activeTab === 'profile' ? 'page' : undefined}
		onclick={() => handleNavClick('profile')}
	>
		<span
			class={`inline-block w-full rounded-full border p-1 ${activeTab === 'profile' || fullPath.includes('settings') ? 'border-brand-burnt-orange' : 'border-transparent'}`}
		>
			<img
				width="24px"
				height="24px"
				class="aspect-square rounded-full"
				src={profileSrc}
				alt="profile"
			/>
		</span>
	</button>
</nav>

<style>
	nav {
		view-transition-name: bottomNav;
	}
</style>
