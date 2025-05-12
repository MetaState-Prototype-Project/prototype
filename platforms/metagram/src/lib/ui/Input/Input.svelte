<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";

    interface IInputProps extends HTMLInputAttributes {
        type: "text" | "number" | "email" | "";
        value: string | number;

    }

    let {type}:IInputProps = $props();
</script>

<input {type}>