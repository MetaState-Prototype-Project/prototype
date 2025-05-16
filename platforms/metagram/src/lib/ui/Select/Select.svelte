<script lang="ts">
	let countries = [
		{ code: '+41', flag: '🇬🇧', name: 'United Kingdom' },
		{ code: '+49', flag: '🇩🇪', name: 'Germany' },
		{ code: '+33', flag: '🇫🇷', name: 'France' }
		// Add more as needed
	];

	let selectedCode = countries[0].code;
</script>

<div class="bg-grey flex w-[max-content] items-center space-x-2 rounded-full p-1.5">
	<div class="rounded-full text-xl">{countries.find((c) => c.code === selectedCode)?.flag}</div>
	<select
		bind:value={selectedCode}
		class="text-md focus:ring-2 focus:ring-transparent focus:outline-none"
	>
		{#each countries as country}
			<option value={country.code} class="text-md text-black-600">
				{country.code}
			</option>
		{/each}
	</select>
</div>
