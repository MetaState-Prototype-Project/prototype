<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { Home, CommentsTwo, Search, Camera } from '$lib/icons';
	import { goto } from '$app/navigation';
	import { isNavigatingThroughNav } from '$lib/store/store.svelte';
	import { page } from '$app/state';

	interface IBottomNavProps extends HTMLAttributes<HTMLElement> {
		activeTab?: string;
		profileSrc: string;
	}
	let {
		activeTab = $bindable('home'),
		profileSrc = 'https://picsum.photos/200'
	}: IBottomNavProps = $props();

	const tabs = ['home', 'discover', 'post', 'messages', 'profile', 'settings'];
	let previousTab = $state('home');
	let _activeTab = $derived(page.url.pathname);
	let fullPath = $derived(page.url.pathname);

	const handleNavClick = (newTab: string) => {
		// activeTab = newTab;
		isNavigatingThroughNav.value = true;
		const fromIndex = tabs.indexOf(previousTab);
		const toIndex = tabs.indexOf(newTab);
		const direction = toIndex > fromIndex ? 'right' : 'left';
		document.documentElement.setAttribute('data-transition', direction);
		previousTab = newTab;
		goto(`/${newTab}`);
	};

	$effect(() => {
		activeTab = _activeTab.split('/').pop() ?? '';
	});
</script>

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
