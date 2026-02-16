<script module>
	import { Shield02Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';

	export { ButtonText, ButtonIcon };
</script>

{#snippet ButtonText()}
	Settings Button
{/snippet}

{#snippet ButtonIcon()}
	<HugeiconsIcon size="24px" icon={Shield02Icon} color="var(--color-brand-burnt-orange)" />
{/snippet}
