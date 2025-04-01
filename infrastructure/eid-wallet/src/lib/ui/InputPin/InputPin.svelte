<script lang="ts">
import { cn } from "$lib/utils";
import { onMount } from "svelte";
import type { HTMLAttributes } from "svelte/elements";

const KEYBOARD = {
	BACKSPACE: "Backspace",
	DELETE: "Delete",
	ANDROID_BACKSPACE: "Backspace",
};

let inputs = $state([0]);
let pins: { [key: number]: string } = $state({});

interface IInputPinProps extends HTMLAttributes<HTMLDivElement> {
	pin: string;
	variant?: "lg" | "sm";
	size?: number;
	focusOnMount?: boolean | undefined;
	inFocus?: boolean | undefined;
	isError?: boolean;
}

let {
	pin = $bindable(""),
	variant = "lg",
	size = 4,
	focusOnMount = true,
	inFocus = false,
	isError = $bindable(false),
	...restProps
}: IInputPinProps = $props();

onMount(async () => {
	inputs = createArray(size);
	pins = await createValueSlot(inputs);
	pin = calcPin(pins);
	if (!focusOnMount) return;
	document.getElementById("pin0")?.focus();
});

$effect(() => {
	pin = calcPin(pins);
});

const calcPin = (pins: { [key: number]: string }) => {
	return Object.values(pins).join("") || "";
};

const isKeyDelete = (key: string) => {
	return (
		key === KEYBOARD.BACKSPACE ||
		key === KEYBOARD.DELETE ||
		key === KEYBOARD.ANDROID_BACKSPACE
	);
};

const changeHandler = (e: KeyboardEvent, i: number) => {
	const current = document.activeElement ?? document.getElementById("pin0");
	const items = Array.from(document.getElementsByClassName("pin-item"));
	const currentIndex = items.indexOf(current as HTMLElement);
	let newIndex: number;

	const regx = /^\d+$/;

	if (isKeyDelete(e.key)) {
		if (pins[i] !== "") {
			pins[i] = "";
			return;
		}
		if (currentIndex > 0) {
			newIndex = currentIndex - 1;
			(items[newIndex] as HTMLInputElement)?.focus();
		}
	}

	if (regx.test(e.key)) {
		pins[i] = e.key;
		if (currentIndex < items.length - 1) {
			newIndex = currentIndex + 1;
			(items[newIndex] as HTMLInputElement)?.focus();
		}
	}
};

const createArray = (size: number) => {
	return new Array(size);
};

const createValueSlot = (arr: number[]) => {
	return arr.reduce(
		(obj, item) => {
			obj[item] = "";
			return obj;
		},
		{} as Record<number, string>,
	);
};

const uniqueId = `input${Math.random().toString().split(".")[1]}`;
const cBase =
	"relative w-full margin-x-[auto] flex justify-between items-center gap-[10px] flex-row flex-nowrap select-none";
</script>
  

<div
  {...restProps}
  class={cn(`${cBase} ${variant === 'sm' && 'sm'}`, restProps.class)}
>
  {#if inputs.length}
    {#each inputs as item, i}
      <div
        class="singular-input relative w-[68px] h-[81px] flex justify-center items-center select-none"
      >
        <input
          bind:value={pins[i]}
          maxLength="1"
          class="pin-item w-[68px] h-[81px] rounded-[64px] border-[1px] border-transparent text-xl text-center bg-gray select-none"
          class:error={isError}
          id={uniqueId}
          type="tel"
          pattern="\d{1}"
          onfocusin={() => (inFocus = true)}
          onfocusout={() => {
            if (i === inputs.length - 1) inFocus = false
          }}
          maxlength="1"
          onkeydown={(event) => {
            event.preventDefault()
            changeHandler(event, i)
          }}
          placeholder=""
        />
        {#if pins[i] !== ''}
          <div 
            class="mask w-[9px] h-[9px] bg-black rounded-full"
            class:hidden={!pins[i]} 
          ></div>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .sm {
    scale: 0.7;
    transform-origin: 0 0;
    justify-content: flex-start;
  }

  .singular-input .mask {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  input.error + .mask {
    color: var(--color-danger-500);
  }

  input {
    color: transparent;
    box-sizing: border-box;
    transition: all 0.4s;
    line-height: 81px;
    -webkit-text-security: disc;
  }

  input.error {
    border-color: var(--color-danger-500);
  }

  input:focus {
    outline: none;
    border-color: var(--color-primary);
  }
</style>
