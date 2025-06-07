<script lang="ts">
	import QrCode from 'svelte-qrcode';

	export let data: string;
</script>

<QrCode value={data} size={330} />
