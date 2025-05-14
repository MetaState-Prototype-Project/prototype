<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { Home, CommentsTwo, Search, Camera } from '$lib/icons';
	import { goto } from '$app/navigation';

	interface IBottomNavProps extends HTMLAttributes<HTMLElement> {
		activeTab: string;
		profileSrc: string;
	}
	let {
		activeTab = $bindable('home'),
		profileSrc = 'https://picsum.photos/200'
	}: IBottomNavProps = $props();

	const handleClick = () => {
		goto(`/${activeTab}`);
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
	<label for="home" onclick={handleClick}>
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
	<label for="search" onclick={handleClick}>
		<Search
			size="24px"
			color={activeTab === 'search'
				? 'var(--color-brand-burnt-orange)'
				: 'var(--color-black-400)'}
			fill={activeTab === 'search' ? 'var(--color-brand-burnt-orange)' : 'white'}
		/>
	</label>
	<input
		id="search"
		type="radio"
		value="search"
		bind:group={activeTab}
		name={'navTabs'}
		class="hidden"
	/>

	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<label for="camera" onclick={handleClick}>
		<Camera
			size="24px"
			color={activeTab === 'camera'
				? 'var(--color-brand-burnt-orange)'
				: 'var(--color-black-400)'}
			fill={activeTab === 'camera' ? 'var(--color-brand-burnt-orange)' : 'white'}
		/>
	</label>
	<input
		id="camera"
		type="radio"
		value="camera"
		bind:group={activeTab}
		name={'navTabs'}
		class="hidden"
	/>

	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<label for="messages" onclick={handleClick}>
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
	<label for="profile" onclick={handleClick}>
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
