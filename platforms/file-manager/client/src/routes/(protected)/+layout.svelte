<script lang="ts">
	import UserMenuDropdown from '$lib/components/UserMenuDropdown.svelte';
</script>

<div class="min-h-screen bg-gray-50">
	<header class="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md transform rotate-12">
						<svg class="w-6 h-6 text-white transform -rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
						</svg>
					</div>
					<h1 class="text-2xl font-bold text-gray-900">File Manager</h1>
				</div>
				<UserMenuDropdown />
			</div>
		</div>
	</header>

	<slot />
</div>

