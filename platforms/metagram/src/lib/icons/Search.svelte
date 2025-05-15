<script lang="ts">
	import type { ISvgProps } from './../types';

	let { size = '20px', color = '#A5A5A5', fill = 'white', ...restProps }: ISvgProps = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	{fill}
	xmlns="http://www.w3.org/2000/svg"
	{...restProps}
>
	<path
		d="M17 17L21 21"
		stroke={color}
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
	<path
		d="M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z"
		stroke={color}
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
</svg>
