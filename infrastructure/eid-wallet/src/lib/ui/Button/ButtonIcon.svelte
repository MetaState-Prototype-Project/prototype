<script lang="ts" generics="T">
import { cn } from "$lib/utils";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/svelte";
import type { HTMLButtonAttributes } from "svelte/elements";

interface IButtonProps extends HTMLButtonAttributes {
	icon: IconSvgElement;
	variant?: "white" | "clear-on-light" | "clear-on-dark";
	isLoading?: boolean;
	callback?: () => Promise<void>;
	onclick?: () => void;
	blockingClick?: boolean;
	type?: "button" | "submit" | "reset";
	bgSize?: "sm" | "md" | "lg";
	iconSize?: "sm" | "md" | "lg" | number;
	strokeWidth?: number;
	isActive?: boolean;
}

const {
	icon,
	variant = "white",
	isLoading,
	callback,
	onclick,
	blockingClick,
	type = "button",
	bgSize = "md",
	iconSize = undefined,
	strokeWidth,
	isActive = false,
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

const variantClasses = {
	white: { background: "bg-white", text: "text-black" },
	"clear-on-light": { background: "transparent", text: "text-black" },
	"clear-on-dark": { background: "transparent", text: "text-white" },
};

const disabledClasses = {
	white: { background: "bg-white", text: "text-black-500" },
	"clear-on-light": { background: "bg-transparent", text: "text-black-500" },
	"clear-on-dark": { background: "bg-transparent", text: "text-black-500" },
};

const isActiveClasses = {
	white: { background: "bg-secondary-500", text: "text-black" },
	"clear-on-light": { background: "bg-secondary-500", text: "text-black" },
	"clear-on-dark": { background: "bg-secondary-500", text: "text-black" },
};

const sizeVariant = {
	sm: "h-8 w-8",
	md: "h-[54px] w-[54px]",
	lg: "h-[108px] w-[108px]",
};

const iconSizeVariant = {
	sm: 24,
	md: 30,
	lg: 36,
};

const resolvedIconSize =
	typeof iconSize === "number" ? iconSize : iconSizeVariant[iconSize ?? bgSize];

const classes = $derived({
	common: cn(
		"cursor-pointer w-min flex items-center justify-center rounded-full font-semibold duration-100",
		variant === "white" ? sizeVariant[bgSize] : "",
	),
	background: disabled
		? disabledClasses[variant].background
		: isActive
			? isActiveClasses[variant].background
			: variantClasses[variant].background,
	text: disabled
		? disabledClasses[variant].text
		: isActive
			? isActiveClasses[variant].text
			: variantClasses[variant].text,
	disabled: "cursor-not-allowed",
});
</script>

<button
  {...restProps}
  class={cn(
    [
      classes.common,
      classes.background,
      classes.text,
      disabled && classes.disabled,
      restProps.class,
    ].join(' ')
  )}
  {disabled}
  onclick={callback ? handleClick : onclick}
  {type}
>
  {#if isLoading || isSubmitting}
    <div
      class="loading loading-spinner absolute loading-lg {variantClasses[
        variant
      ].text}"
    ></div>
  {:else}
    <HugeiconsIcon {icon} size={resolvedIconSize} {strokeWidth} />
  {/if}
</button>

<!-- 
    @component
    export default ButtonIcon
    @description
    ButtonIcon component is a button with an icon.
    
    @props
	- icon: IconSvgElement - Needs icon from Hugeicon library
    - variant: 'white' | 'clear-on-light' | 'clear-on-dark' .
    - isLoading: boolean 
    - callback: () => Promise<void> 
    - onclick: () => void 
    - blockingClick: boolean - Prevents multiple clicks
    - type: 'button' | 'submit' | 'reset' 
    - bgSize: 'sm' | 'md' | 'lg' 
    - iconSize: 'sm' | 'md' | 'lg' | number 
	- strokeWidth: number
    - isActive: boolean 

   
    @usage
    ```html
    <script lang="ts">
      import * as Button from '$lib/ui/Button'
      import { FlashlightIcon } from '@hugeicons/core-free-icons'
      
      let flashlightOn = $state(false)
    </script>

    <Button.Icon
      variant="white"
      aria-label="Open pane"
      bgSize="md"
      icon={FlashlightIcon}
      onclick={() => (flashlightOn = !flashlightOn)}
      isActive={flashlightOn}
    ></Button.Icon>
    ```
     -->
