<script lang="ts">
import { cn } from "$lib/utils";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/svelte";
import type { HTMLButtonAttributes } from "svelte/elements";

interface IButtonProps extends HTMLButtonAttributes {
	icon: IconSvgElement;
	isLoading?: boolean;
	callback?: () => Promise<void> | void;
	onclick?: () => void;
	blockingClick?: boolean;
	type?: "button" | "submit" | "reset";
	bgSize?: "sm" | "md" | "lg" | number | string;
	bgColor?:
		| "black"
		| "white"
		| "gray"
		| "primary"
		| "secondary"
		| "danger"
		| string;
	iconSize?: "sm" | "md" | "lg" | number | string;
	iconColor?:
		| "black"
		| "white"
		| "gray"
		| "primary"
		| "secondary"
		| "danger"
		| string;
	strokeWidth?: number;
}

const {
	icon,
	isLoading,
	callback,
	onclick,
	blockingClick,
	type = "button",
	bgSize,
	bgColor = "transparent",
	iconSize = "md",
	iconColor = "black",
	strokeWidth = 1.5,
	children = undefined,
	...restProps
}: IButtonProps = $props();

let isSubmitting = $state(false);
const disabled = $derived(restProps.disabled || isLoading || isSubmitting);

const handleClick = async () => {
	if (typeof callback !== "function") return;

	if (blockingClick) isSubmitting = true;
	try {
		await callback();
	} catch (error) {
		console.error("Error in button callback:", error);
	} finally {
		isSubmitting = false;
	}
};

const sizeVariant = {
	sm: "h-8 w-8",
	md: "h-[54px] w-[54px]",
	lg: "h-[108px] w-[108px]",
} as const;

const iconSizeVariant = {
	sm: 24,
	md: 30,
	lg: 36,
} as const;

const backgroundColor: Record<string, string> = {
	black: "bg-black",
	white: "bg-white",
	gray: "bg-gray",
	primary: "bg-primary",
	secondary: "bg-secondary",
	danger: "bg-danger",
} as const;

const textColor: Record<string, string> = {
	black: "text-black",
	white: "text-white",
	gray: "text-gray",
	primary: "text-primary",
	secondary: "text-secondary",
	danger: "text-danger",
} as const;

const resolvedIconSize =
	iconSize === undefined
		? iconSizeVariant.md
		: typeof iconSize === "number"
			? iconSize
			: iconSize in iconSizeVariant
				? iconSizeVariant[iconSize as keyof typeof iconSizeVariant]
				: iconSize;

const resolvedBgSize =
	bgSize === undefined
		? "" // if bgSize is empty, there is no background
		: typeof bgSize === "number"
			? `h-${bgSize} w-${bgSize}`
			: bgSize in sizeVariant
				? sizeVariant[bgSize as keyof typeof sizeVariant]
				: bgSize;

const classes = $derived({
	common: cn(
		"cursor-pointer flex items-center justify-center rounded-full font-semibold duration-100",
	),
	bgSize: resolvedBgSize,
	background: bgColor in backgroundColor ? backgroundColor[bgColor] : bgColor,
	iconColor: iconColor in textColor ? textColor[iconColor] : iconColor,
	disabled: "cursor-not-allowed opacity-50",
	iconSize: resolvedIconSize,
});
</script>

<button
	{...restProps}
	class={cn([classes.common, classes.bgSize, classes.iconColor, classes.background, disabled && classes.disabled, restProps.class].join(' '))}
	{disabled}
	onclick={callback ? handleClick : onclick}
	{type}
>
	{#if isLoading || isSubmitting}
	<div class="loading loading-spinner absolute loading-lg {cn(classes.iconColor)}"></div>
	{:else}
	<HugeiconsIcon {icon} size={classes.iconSize} {strokeWidth} color={classes.iconColor} />
	{/if}
</button>

<!-- 
    @component
    export default ButtonIcon
    @description
    ButtonIcon is a customizable icon button component supporting both predefined and custom styles for size and colors.

    @props
    - icon: IconSvgElement - An icon from the Hugeicons library.
    - isLoading: boolean - Displays a loading spinner when true.
    - callback: () => Promise<void> - Async function executed on click.
    - onclick: () => void - Regular click handler.
    - blockingClick: boolean - Prevents multiple clicks while an async action is in progress.
    - type: 'button' | 'submit' | 'reset' - Defines the button type.
    - bgSize: 'sm' | 'md' | 'lg' | number | string - Predefined size, numeric pixel value, or a Tailwind class.
    - iconSize: 'sm' | 'md' | 'lg' | number | string - Predefined size, numeric pixel value, or a Tailwind class.
    - bgColor: 'black' | 'white' | 'gray' | 'primary' | 'secondary' | 'danger' | string - Predefined color or any Tailwind background class.
    - iconColor: 'black' | 'white' | 'gray' | 'primary' | 'secondary' | 'danger' | string - Predefined color or any Tailwind text class.
    - strokeWidth: number - Defines the stroke width of the icon.

    @usage
    ```html
    <script lang="ts">
      import * as Button from '$lib/ui/Button';
      import { FlashlightIcon, Upload03Icon } from '@hugeicons/core-free-icons';

	  function shareBtn() {
	  	console.log('Share button clicked');		
	}				
      
      let flashlightOn = $state(false);
    </script>

    <Button.Icon
      aria-label="Toggle flashlight"
      bgSize="w-12 h-12"  // Custom Tailwind class for background size
      iconSize={32}        // Numeric pixel size
      bgColor="primary"    // Predefined or Tailwind color class
      iconColor="white"    // Predefined or Tailwind text color
      icon={FlashlightIcon}
      onclick={() => (flashlightOn = !flashlightOn)}
    />

	<Button.Icon icon={Upload03Icon} iconColor={"white"} strokeWidth={2} onclick={shareBtn} />
    ```
-->