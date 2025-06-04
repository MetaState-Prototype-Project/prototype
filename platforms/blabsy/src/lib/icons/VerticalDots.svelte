<script lang="ts">
	import type { ISvgProps } from './../types';

	let { size = '20px', color = '#A5A5A5', ...restProps }: ISvgProps = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	{...restProps}
>
	<path
		d="M11.9919 12H12.0009"
		stroke={color}
		stroke-width="2.5"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
	<path
		d="M11.9843 18H11.9933"
		stroke={color}
		stroke-width="2.5"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
	<path
		d="M11.9998 6H12.0088"
		stroke={color}
		stroke-width="2.5"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
</svg>
