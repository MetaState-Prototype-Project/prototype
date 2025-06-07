<script lang="ts">
	import type { ISvgProps } from './../types';

	let { size = '20px', color = '#A5A5A5', fill = 'white', ...restProps }: ISvgProps = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 25 24"
	{fill}
	xmlns="http://www.w3.org/2000/svg"
	{...restProps}
>
	<path
		d="M3.66405 11.3497L4.5 11.5587L4.95686 16.1005C5.215 18.6668 5.34407 19.9499 6.201 20.7249C7.05793 21.5 8.34753 21.5 10.9267 21.5H14.0733C16.6525 21.5 17.9421 21.5 18.799 20.7249C19.6559 19.9499 19.785 18.6668 20.0431 16.1005L20.5 11.5587L21.336 11.3497C22.0201 11.1787 22.5 10.564 22.5 9.85882C22.5 9.35735 22.2553 8.88742 21.8445 8.59985L13.6469 2.86154C12.9583 2.37949 12.0417 2.37949 11.3531 2.86154L3.15549 8.59985C2.74467 8.88742 2.5 9.35735 2.5 9.85882C2.5 10.564 2.97993 11.1787 3.66405 11.3497Z"
		stroke={color}
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
	<path
		d="M12.5 17C13.8807 17 15 15.8807 15 14.5C15 13.1193 13.8807 12 12.5 12C11.1193 12 10 13.1193 10 14.5C10 15.8807 11.1193 17 12.5 17Z"
		fill="white"
		stroke={color}
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
</svg>
