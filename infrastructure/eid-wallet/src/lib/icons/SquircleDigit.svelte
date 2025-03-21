<script lang="ts">
	// import type { ISvgProps } from '$lib/types/Svg.types';

	let { size = '36px', color = 'currentColor', ...restProps }
	// : ISvgProps 
	= $props();
</script>

<svg 
width={size}
height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" 
{...restProps}>
	<path d="M3.33334 10.9157C3.47209 8.11607 3.88717 6.37056 5.12886 5.12885C6.37057 3.88716 8.11608 3.47208 10.9157 3.33333M28.6667 10.9157C28.5279 8.11607 28.1128 6.37056 26.8712 5.12885C25.6295 3.88716 23.8839 3.47208 21.0843 3.33333M21.0843 28.6667C23.8839 28.5279 25.6295 28.1128 26.8712 26.8712C28.1128 25.6295 28.5279 23.8839 28.6667 21.0843M10.9157 28.6667C8.11608 28.5279 6.37057 28.1128 5.12886 26.8712C3.88717 25.6295 3.47209 23.8839 3.33334 21.0843" 
		stroke={color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
	<path d="M22 20.6667V14.6667C22 11.353 19.3137 8.66667 16 8.66667C12.6863 8.66667 10 11.353 10 14.6667V20.6667" 
		stroke={color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
	<path d="M18 16.6667V14.6667C18 13.5621 17.1045 12.6667 16 12.6667C14.8955 12.6667 14 13.5621 14 14.6667V22M18 20.6667V23.3333" 
		stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
	</svg>
	
