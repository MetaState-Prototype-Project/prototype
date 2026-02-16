<script lang="ts">
	import type { ISvgProps } from './../types';

	let { size = '20px', color = '#A5A5A5', ...restProps }: ISvgProps = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 20 20"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	{...restProps}
>
	<path
		d="M14.1472 15.5729C16.1681 14.2852 17.5 12.0834 17.5 9.58331C17.5 5.61377 14.1422 2.39581 10 2.39581C9.42717 2.39581 8.86933 2.45735 8.33333 2.57392M14.1472 15.5729V12.7778M14.1472 15.5729H17.0833M5.83333 3.60615C3.82336 4.89552 2.5 7.09131 2.5 9.58331C2.5 13.5529 5.85787 16.7708 10 16.7708C10.5728 16.7708 11.1307 16.7092 11.6667 16.5927M5.83333 3.60615V6.38887M5.83333 3.60615H2.91667"
		stroke={color}
		stroke-width="1.25"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
</svg>
