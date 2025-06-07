<script lang="ts">
	import type { ISvgProps } from './../types';

	let { size = '20px', color = '#DA4A11', ...restProps }: ISvgProps = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	{...restProps}
>
	<rect width="24" height="24" rx="12" fill={color} />
	<path
		d="M16.0837 7.91663L7.91699 16.0833M7.91699 7.91663L16.0837 16.0833"
		stroke="white"
		stroke-width="1.75"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
</svg>
