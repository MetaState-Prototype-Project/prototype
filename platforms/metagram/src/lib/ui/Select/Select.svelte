<script lang="ts">
	let countries = [
		{ code: '+41', flag: '🇬🇧', name: 'United Kingdom' },
		{ code: '+49', flag: '🇩🇪', name: 'Germany' },
		{ code: '+33', flag: '🇫🇷', name: 'France' }
		// Add more as needed
	];

	let selectedCode = countries[0].code;
</script>

<div class="flex items-center space-x-2">
	<div class="text-xl">{countries.find((c) => c.code === selectedCode)?.flag}</div>
	<select
		bind:value={selectedCode}
		class="rounded-full bg-gray-100 px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
	>
		{#each countries as country}
			<option value={country.code}>
				{country.code} ({country.name})
			</option>
		{/each}
	</select>
</div>
