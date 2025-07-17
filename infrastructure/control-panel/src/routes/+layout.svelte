<script lang="ts">
	import { ButtonAction } from '$lib/ui';
	import '../app.css';

	let { children } = $props();
</script>

<main>
	<header class="flex justify-between items-center px-10 py-5 border-b-[1px] border-black-100 mb-6">
		<h4 class="text-primary font-semibold text-xl">Control Panel</h4>
		<div class="flex items-center gap-4">
			<ButtonAction size="sm"  variant="soft">Refresh</ButtonAction>
			<ButtonAction size="sm" class="whitespace-nowrap" variant="soft">Start Monitering</ButtonAction>
		</div>
	</header>
	<section class="px-10">
		{@render children()}
	</section>
</main>
