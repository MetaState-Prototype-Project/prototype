<script lang="ts">
	let {
		title,
		searchValue = $bindable(''),
		rightTitle,
		placeholder
	}: { title: string; searchValue: string; rightTitle: string, placeholder: string } = $props();
</script>

<header class="mb-4 flex w-full items-center justify-between px-4">
	<div class="flex items-center gap-4">
		<p class="text-black-700 font-semibold whitespace-nowrap">{title}</p>
		<input
			type="text"
			placeholder={placeholder}
			bind:value={searchValue}
			class="bg-black-100 text-black-700 placeholder:text-black-700 w-full rounded-[8px] border border-gray-300 px-4 py-1.5 text-xs outline-0"
		/>
	</div>

	<div class="flex items-center gap-2">
		<span class="bg-secondary inline-block h-2 w-2 rounded-full"></span>
		<p class="text-black-700 text-sm">{rightTitle}</p>
	</div>
</header>
