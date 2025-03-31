<script lang="ts">
import { InputPin } from "$lib/ui";

let currentPin = $state("");
let newPin = $state("");
let repeatPin = $state("");
let isError = $state(false);

$effect(() => {
	if (repeatPin.length === 4 && newPin !== repeatPin) isError = true;
	else isError = false;
});
</script>

<main class="h-[100vh] pt-[3vh] px-[5vw] pb-[4.5vh] flex flex-col gap-[3vh]">
    <div>
        <p class="mb-[1vh]">Enter you current PIN</p>
        <InputPin bind:pin={currentPin} variant="sm"/>
    </div>
    <div>
        <p class="mb-[1vh]">Enter your new PIN</p>
        <InputPin bind:pin={newPin} variant="sm"/>
    </div>
    <div>
        <p class="mb-[1vh]">Confirm new PIN</p>
        <InputPin bind:pin={repeatPin} variant="sm"/>
    </div>
    <p class={`small text-danger mt-[3.4vh] ${isError ? "block" : "hidden"}`}>Your PIN does not match, try again.</p>
</main>