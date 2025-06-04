<script lang="ts">
	let { children } = $props();
</script>

<div class="flex flex-col gap-5">
	{@render children()}
</div>
