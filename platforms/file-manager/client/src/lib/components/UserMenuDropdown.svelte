<script lang="ts">
	import { currentUser, logout } from '$lib/stores/auth';
	import { goto } from '$app/navigation';

	let isOpen = $state(false);

	function handleLogout() {
		logout();
		goto('/auth');
		isOpen = false;
	}

	function toggleDropdown() {
		isOpen = !isOpen;
	}

	function closeDropdown() {
		isOpen = false;
	}
</script>

<div class="relative">
	<button
		onclick={toggleDropdown}
		class="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
		type="button"
	>
		<span class="text-sm font-medium text-gray-700">
			{$currentUser?.name || $currentUser?.ename || 'User'}
		</span>
		<svg
			class="w-4 h-4 text-gray-500 transition-transform {isOpen ? 'rotate-180' : ''}"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if isOpen}
		<!-- Backdrop -->
		<div
			class="fixed inset-0 z-10"
			onclick={closeDropdown}
			role="button"
			tabindex="-1"
		></div>

		<!-- Dropdown Menu -->
		<div class="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
			<!-- User Info Section -->
			<div class="px-4 py-3 border-b border-gray-200 bg-gray-50">
				<div class="text-sm font-medium text-gray-900">
					{$currentUser?.name || $currentUser?.ename || 'User'}
				</div>
				{#if $currentUser?.ename && $currentUser?.name}
					<div class="text-xs text-gray-500 mt-1">@{$currentUser.ename.replace(/^@+/, '')}</div>
				{/if}
			</div>

		<!-- Menu Items -->
		<div class="py-1">
			<button
				onclick={() => { goto('/storage'); closeDropdown(); }}
				class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
				type="button"
			>
				<svg
					class="w-4 h-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
					/>
				</svg>
				Storage
			</button>
			<button
				onclick={handleLogout}
				class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
				type="button"
			>
				<svg
					class="w-4 h-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
					/>
				</svg>
				Logout
			</button>
		</div>
		</div>
	{/if}
</div>

