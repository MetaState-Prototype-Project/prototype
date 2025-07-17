<script context="module">
	import { ArrowRight01Icon, SettingsIcon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	export { ButtonText, ButtonNavText, ButtonNavSettings };
</script>

{#snippet ButtonText()}
	Button
{/snippet}

{#snippet ButtonNavText()}
	Nav Button
{/snippet}

{#snippet ButtonNavSettings()}
	<div class="flex items-center gap-2">
		<div class="bg-gray flex max-w-max items-center rounded-full object-cover p-3">
			<HugeiconsIcon icon={SettingsIcon} size={30} color="var(--color-black-500)" />
		</div>
		<p>Settings</p>
	</div>
	<HugeiconsIcon size={30} color="var(--color-black-500)" icon={ArrowRight01Icon} />
{/snippet}
