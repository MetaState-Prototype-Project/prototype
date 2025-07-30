<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { CommentsTwo, Home, Search, Settings } from '$lib/icons';
	import Button from '$lib/ui/Button/Button.svelte';
	import { cn, getAuthId } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	let ownerId: string | null = $state(null);

	interface ISideBarProps extends HTMLAttributes<HTMLElement> {
		activeTab?: string;
		profileSrc: string;
		handlePost?: () => Promise<void>;
	}
	let {
		activeTab = $bindable('home'),
		profileSrc = 'https://picsum.photos/200',
		handlePost,
		...restProps
	}: ISideBarProps = $props();

	$effect(() => {
		ownerId = getAuthId();
		const pathname = page.url.pathname;
		if (pathname.includes('/home')) {
			activeTab = 'home';
		} else if (pathname.includes('/discover')) {
			activeTab = 'discover';
		} else if (pathname.includes('/messages')) {
			activeTab = 'messages';
		} else if (pathname.includes('/settings')) {
			activeTab = 'settings';
		} else if (pathname.includes('/profile')) {
			activeTab = 'profile';
		} else {
			activeTab = '';
		}
	});

	const cBase =
		'hidden h-screen border border-y-0 border-e-gray-200 py-14 md:flex md:justify-center';
</script>

<nav
	{...restProps}
	aria-label="Main navigation"
	class={cn([cBase, restProps.class].join(' '))}
	role="tablist"
>
	<div class="flex flex-col items-start justify-start gap-12">
		<h1 class="bg-[image:var(--color-brand-gradient)] bg-clip-text text-transparent">
			pictique
		</h1>
		<button
			type="button"
			class="flex items-center gap-2"
			aria-current={activeTab === 'home' ? 'page' : undefined}
			onclick={() => {
				activeTab = 'home';
				goto('/home');
			}}
		>
			<Home
				size="24px"
				color={activeTab === 'home'
					? 'var(--color-brand-burnt-orange)'
					: 'var(--color-black-400)'}
				fill={activeTab === 'home' ? 'var(--color-brand-burnt-orange-300)' : 'white'}
			/>
			<h3
				class={`${activeTab === 'home' ? 'text-brand-burnt-orange' : 'text-black-800'} mt-[4px]`}
			>
				Feed
			</h3>
		</button>

		<button
			type="button"
			class="flex items-center gap-2"
			aria-current={activeTab === 'discover' ? 'page' : undefined}
			onclick={() => {
				activeTab = 'discover';
				goto('/discover');
			}}
		>
			<Search
				size="24px"
				color={activeTab === 'discover'
					? 'var(--color-brand-burnt-orange)'
					: 'var(--color-black-400)'}
				fill={activeTab === 'discover' ? 'var(--color-brand-burnt-orange-300)' : 'white'}
			/>
			<h3
				class={`${activeTab === 'discover' ? 'text-brand-burnt-orange' : 'text-black-800'} mt-[4px]`}
			>
				Search
			</h3>
		</button>

		<button
			type="button"
			class="flex items-center gap-2"
			aria-current={activeTab === 'messages' ? 'page' : undefined}
			onclick={() => {
				activeTab = 'messages';
				goto('/messages');
			}}
		>
			<CommentsTwo
				size="24px"
				color={activeTab === 'messages'
					? 'var(--color-brand-burnt-orange)'
					: 'var(--color-black-400)'}
				fill={activeTab === 'messages' ? 'var(--color-brand-burnt-orange-300)' : 'white'}
			/>
			<h3
				class={`${activeTab === 'messages' ? 'text-brand-burnt-orange' : 'text-black-800'} mt-[4px]`}
			>
				Messages
			</h3>
		</button>

		<button
			type="button"
			class="flex items-center gap-2"
			aria-current={activeTab === 'settings' ? 'page' : undefined}
			onclick={() => {
				activeTab = 'settings';
				goto('/settings');
			}}
		>
			<Settings
				size="24px"
				color={activeTab === 'settings'
					? 'var(--color-brand-burnt-orange)'
					: 'var(--color-black-400)'}
				fill={activeTab === 'settings' ? 'var(--color-brand-burnt-orange-300)' : 'white'}
			/>
			<h3
				class={`${activeTab === 'settings' ? 'text-brand-burnt-orange' : 'text-black-800'} mt-[4px]`}
			>
				Settings
			</h3>
		</button>
		<button
			type="button"
			class="flex items-center gap-2"
			aria-current={activeTab === 'profile' ? 'page' : undefined}
			onclick={() => {
				activeTab = 'profile';
				goto(`/profile/${ownerId}`);
			}}
		>
			<span
				class={`inline-block w-full rounded-full border ${activeTab === 'profile' ? 'border-brand-burnt-orange' : 'border-transparent'}`}
			>
				<img
					width="24px"
					height="24px"
					class="aspect-square rounded-full object-cover"
					src={profileSrc}
					alt="profile"
				/>
			</span>
			<h3
				class={`${activeTab === 'profile' ? 'text-brand-burnt-orange' : 'text-black-800'} mt-[4px]`}
			>
				Profile
			</h3>
		</button>
		{#if handlePost}
			<Button size="sm" variant="secondary" callback={handlePost}>Post a photo</Button>
		{/if}
	</div>
</nav>
