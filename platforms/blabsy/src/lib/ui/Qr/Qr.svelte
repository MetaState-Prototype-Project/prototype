<script lang="ts">
	import QrCode from 'svelte-qrcode';

	export let data: string;
	export let background = '#ffffff';
	export let color = '#1d1d1d';
</script>

<QrCode value={data} {background} {color} size={330} />
