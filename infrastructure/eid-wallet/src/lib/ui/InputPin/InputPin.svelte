<script lang="ts">
    import { cn } from '$lib/utils';
	import { onMount } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	const KEYBOARD = {
		BACKSPACE: 'Backspace',
		DELETE: 'Delete',
		ANDROID_BACKSPACE: 'Backspace'
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
		pin = $bindable(''),
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
		document.getElementById('pin0')?.focus();
	});

	$effect(() => {
		pin = calcPin(pins);
	});

	const calcPin = (pins: { [key: number]: string }) => {
		return Object.values(pins).join('') || '';
	};

	const isKeyDelete = (key: string) => {
		return (
			key === KEYBOARD.BACKSPACE || key === KEYBOARD.DELETE || key === KEYBOARD.ANDROID_BACKSPACE
		);
	};

	const changeHandler = (e: KeyboardEvent, i: number) => {
		const current = document.activeElement ?? document.getElementById('pin0');
		const items = Array.from(document.getElementsByClassName('pin-item'));
		const currentIndex = items.indexOf(current as HTMLElement);
		let newIndex: number;

		const regx = /^\d+$/;

		// backspace pressed
		if (isKeyDelete(e.key)) {
			if (pins[i] !== '') {
				// If there is a value in the current pin, just clear it and stay on the same input
				pins[i] = '';
				return;
			} else {
				// If the current input is already empty, move to the previous input
				newIndex = (currentIndex - 1 + items.length) % items.length;
			}
		} else {
			// When a number is typed, replace the current digit with the typed number
			if (regx.test(e.key)) {
				pins[i] = e.key;
				newIndex = (currentIndex + 1) % items.length;
			} else {
				return;
			}
		}

		// Set focus to the new input if it’s needed
		(items[newIndex] as HTMLInputElement)?.focus();
	};

	const createArray = (size: number) => {
		return new Array(size);
	};

	const createValueSlot = (arr: any[]) => {
		return arr.reduce((obj, item) => {
			return {
				...obj,
				[item]: ''
			};
		}, {});
	};

	let uniqueId = 'input' + Math.random().toString().split('.')[1];
	const cBase = "relative w-full margin-x-[auto] flex justify-start items-center gap-[10px] flex-row flex-nowrap select-none"
</script>

<div {...restProps} class={cn(`${cBase} ${variant === "sm" && "sm" }`, restProps.class)}>
	{#if inputs.length}
		{#each inputs as item, i}
			<div class="singular-input relative w-[68px] h-[81px] flex justify-center items-center select-none">
				<input
					bind:value={pins[i]}
					maxLength="1"
					class="pin-item w-[68px] h-[81px] rounded-[64px] border-[1px] border-transparent text-xl text-center bg-gray-900 select-none {pins[i] ? 'has-value' : ''}"
					class:error={isError}
					id={uniqueId}
					type="tel"
					pattern="\d{1}"
					onfocusin={() => (inFocus = true)}
					onfocusout={() => {
						if (i === inputs.length - 1) inFocus = false;
					}}
					maxlength="1"
					onkeydown={(event) => {
						event.preventDefault();
						changeHandler(event, i);
					}}
					placeholder=""
				/>
				{#if pins[i] !== ''}
					<div class="mask">·</div>
				{/if}
			</div>
		{/each}
	{/if}
</div>

<style>
    .sm {
        scale: 0.8;
        transform-origin: 0 0;
    }

	.singular-input .mask {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		font-size: 24px;
		visibility: hidden;
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

	/* Show the mask when the input has a value */
	.singular-input input.has-value + .mask {
		visibility: visible;
	}
</style>
