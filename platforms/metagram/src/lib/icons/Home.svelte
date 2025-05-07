<script lang="ts">
	import type { ISvgProps } from './../types';

	let { size = '20px', ...restProps }: ISvgProps = $props();
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
		d="M3.16405 11.3497L4 11.5587L4.45686 16.1005C4.715 18.6668 4.84407 19.9499 5.701 20.7249C6.55793 21.5 7.84753 21.5 10.4267 21.5H13.5733C16.1525 21.5 17.4421 21.5 18.299 20.7249C19.1559 19.9499 19.285 18.6668 19.5431 16.1005L20 11.5587L20.836 11.3497C21.5201 11.1787 22 10.564 22 9.85882C22 9.35735 21.7553 8.88742 21.3445 8.59985L13.1469 2.86154C12.4583 2.37949 11.5417 2.37949 10.8531 2.86154L2.65549 8.59985C2.24467 8.88742 2 9.35735 2 9.85882C2 10.564 2.47993 11.1787 3.16405 11.3497Z"
		fill="url(#paint0_linear_1643_261)"
	/>
	<path
		d="M12 17C13.3807 17 14.5 15.8807 14.5 14.5C14.5 13.1193 13.3807 12 12 12C10.6193 12 9.5 13.1193 9.5 14.5C9.5 15.8807 10.6193 17 12 17Z"
		fill="white"
	/>
	<defs>
		<linearGradient
			id="paint0_linear_1643_261"
			x1="-5.55319"
			y1="5.16"
			x2="33.2477"
			y2="6.45747"
			gradientUnits="userSpaceOnUse"
		>
			<stop stop-color="#4D44EF" />
			<stop offset="0.5" stop-color="#F35B5B" />
			<stop offset="1" stop-color="#F7A428" />
		</linearGradient>
	</defs>
</svg>
