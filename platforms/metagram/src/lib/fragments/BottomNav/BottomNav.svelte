<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { Home, CommentsTwo, Search, Camera } from '$lib/icons';
	import { goto } from '$app/navigation';
	import { isNavigatingThroughNav } from '$lib/store/store.svelte';

	interface IBottomNavProps extends HTMLAttributes<HTMLElement> {
		activeTab: string;
		profileSrc: string;
	}
	let {
		activeTab = $bindable('home'),
		profileSrc = 'https://picsum.photos/200'
	}: IBottomNavProps = $props();

	const tabs = ['home', 'discover', 'post', 'messages', 'profile'];
	let previousTab = $state('home');

	const handleNavClick = (newTab: string) => {
		isNavigatingThroughNav.value = true;

		const fromIndex = tabs.indexOf(previousTab);
		const toIndex = tabs.indexOf(newTab);

		const direction = toIndex > fromIndex ? 'right' : 'left';
		document.documentElement.setAttribute('data-transition', direction);

		previousTab = newTab;
		goto(`/${newTab}`);
	};
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<nav
	aria-label="Main navigation"
	class="fixed start-0 bottom-0 flex w-full items-center justify-between px-7 py-2 sm:hidden"
	role="tablist"
>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<label for="home" onclick={() => handleNavClick('home')}>
		<Home
			size="24px"
			color={activeTab === 'home'
				? 'var(--color-brand-burnt-orange)'
				: 'var(--color-black-400)'}
			fill={activeTab === 'home' ? 'var(--color-brand-burnt-orange)' : 'white'}
		/>
	</label>
	<input
		id="home"
		type="radio"
		value="home"
		bind:group={activeTab}
		name={'navTabs'}
		class="hidden"
	/>

	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<label for="discover" onclick={() => handleNavClick('discover')}>
		<Search
			size="24px"
			color={activeTab === 'discover'
				? 'var(--color-brand-burnt-orange)'
				: 'var(--color-black-400)'}
			fill={activeTab === 'discover' ? 'var(--color-brand-burnt-orange)' : 'white'}
		/>
	</label>
	<input
		id="discover"
		type="radio"
		value="discover"
		bind:group={activeTab}
		name={'navTabs'}
		class="hidden"
	/>

	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<label for="post" onclick={() => handleNavClick('post')}>
		<Camera
			size="24px"
			color={activeTab === 'post'
				? 'var(--color-brand-burnt-orange)'
				: 'var(--color-black-400)'}
			fill={activeTab === 'post' ? 'var(--color-brand-burnt-orange)' : 'white'}
		/>
	</label>
	<input
		id="post"
		type="radio"
		value="post"
		bind:group={activeTab}
		name={'navTabs'}
		class="hidden"
	/>

	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<label for="messages" onclick={() => handleNavClick('messages')}>
		<CommentsTwo
			size="24px"
			color={activeTab === 'messages'
				? 'var(--color-brand-burnt-orange)'
				: 'var(--color-black-400)'}
			fill={activeTab === 'messages' ? 'var(--color-brand-burnt-orange)' : 'white'}
		/>
	</label>
	<input
		id="messages"
		type="radio"
		value="messages"
		bind:group={activeTab}
		name={'navTabs'}
		class="hidden"
	/>

	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<label for="profile" onclick={() => handleNavClick('profile')}>
		<span
			class={`inline-block w-full rounded-full border p-1 ${activeTab === 'profile' ? 'border-brand-burnt-orange' : 'border-transparent'}`}
		>
			<img
				width="24px"
				height="24px"
				class="aspect-square rounded-full"
				src={profileSrc}
				alt="profile"
			/>
		</span>
	</label>
	<input
		id="profile"
		type="radio"
		value="profile"
		bind:group={activeTab}
		name={'navTabs'}
		class="hidden"
	/>
</nav>

<style>
	nav {
		view-transition-name: bottomNav;
	}
</style>
