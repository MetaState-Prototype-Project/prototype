<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { Home, CommentsTwo, Search, Camera, Settings } from '$lib/icons';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Button from '$lib/ui/Button/Button.svelte';
	import { cn } from '$lib/utils';

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

	let _activeTab = $derived(page.url.pathname);

	const handleNavClick = (newTab: string) => {
		activeTab = newTab;
		goto(`/${newTab}`);
	};

	$effect(() => {
		activeTab = _activeTab.split('/').pop() ?? '';
	});

	const cBase =
		'hidden h-screen border border-y-0 border-e-gray-200 py-14 md:flex md:justify-center';
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<nav
	{...restProps}
	aria-label="Main navigation"
	class={cn([cBase, restProps.class].join(' '))}
	role="tablist"
>
	<div class="flex flex-col items-start justify-start gap-12">
		<h1 class="bg-[image:var(--color-brand-gradient)] bg-clip-text text-transparent">
			Pictique
		</h1>
		<button
			type="button"
			class="flex items-center gap-2"
			aria-current={activeTab === 'home' ? 'page' : undefined}
			onclick={() => handleNavClick('home')}
		>
			<Home
				size="24px"
				color={activeTab === 'home'
					? 'var(--color-brand-burnt-orange)'
					: 'var(--color-black-400)'}
				fill={activeTab === 'home' ? 'var(--color-brand-burnt-orange)' : 'white'}
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
			onclick={() => handleNavClick('discover')}
		>
			<Search
				size="24px"
				color={activeTab === 'discover'
					? 'var(--color-brand-burnt-orange)'
					: 'var(--color-black-400)'}
				fill={activeTab === 'discover' ? 'var(--color-brand-burnt-orange)' : 'white'}
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
			aria-current={activeTab === 'post' ? 'page' : undefined}
			onclick={() => handleNavClick('post')}
		>
			<Camera
				size="24px"
				color={activeTab === 'post'
					? 'var(--color-brand-burnt-orange)'
					: 'var(--color-black-400)'}
				fill={activeTab === 'post' ? 'var(--color-brand-burnt-orange)' : 'white'}
			/>
			<h3
				class={`${activeTab === 'post' ? 'text-brand-burnt-orange' : 'text-black-800'} mt-[4px]`}
			>
				Upload a photo
			</h3>
		</button>

		<button
			type="button"
			class="flex items-center gap-2"
			aria-current={activeTab === 'messages' ? 'page' : undefined}
			onclick={() => handleNavClick('messages')}
		>
			<CommentsTwo
				size="24px"
				color={activeTab === 'messages'
					? 'var(--color-brand-burnt-orange)'
					: 'var(--color-black-400)'}
				fill={activeTab === 'messages' ? 'var(--color-brand-burnt-orange)' : 'white'}
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
			onclick={() => handleNavClick('settings')}
		>
			<Settings
				size="24px"
				color={activeTab === 'settings'
					? 'var(--color-brand-burnt-orange)'
					: 'var(--color-black-400)'}
				fill={activeTab === 'settings' ? 'var(--color-brand-burnt-orange)' : 'white'}
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
			onclick={() => handleNavClick('profile')}
		>
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
