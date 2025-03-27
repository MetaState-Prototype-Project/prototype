<script lang="ts" generics="T">
import { cn } from "$lib/utils";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/svelte";
import type { HTMLButtonAttributes } from "svelte/elements";

interface IButtonProps extends HTMLButtonAttributes {
	variant?: "white" | "clear-on-light" | "clear-on-dark";
	isLoading?: boolean;
	callback?: () => Promise<void>;
	onclick?: () => void;
	blockingClick?: boolean;
	type?: "button" | "submit" | "reset";
	size?: "sm" | "md" | "lg";
	iconSize?: "sm" | "md" | "lg" | number;
	icon: IconSvgElement;
	isActive?: boolean;
}

const {
	variant = "white",
	isLoading,
	callback,
	onclick,
	blockingClick,
	type = "button",
	size = "md",
	icon,
	iconSize = undefined,
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
	md: 24,
	lg: 36,
};

const resolvedIconSize =
	typeof iconSize === "number" ? iconSize : iconSizeVariant[iconSize ?? size];

const classes = $derived({
	common: cn(
		"cursor-pointer w-min flex items-center justify-center rounded-full font-semibold duration-100",
		sizeVariant[size],
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
    <HugeiconsIcon {icon} size={resolvedIconSize} />
  {/if}
</button>

<!-- 
    @component
    export default ButtonIcon
    @description
    ButtonIcon component is a button with an icon.
    
    @props
    - variant: 'white' | 'clear-on-light' | 'clear-on-dark' .
    - isLoading: boolean 
    - callback: () => Promise<void> 
    - onclick: () => void 
    - blockingClick: boolean - Prevents multiple clicks
    - type: 'button' | 'submit' | 'reset' 
    - size: 'sm' | 'md' | 'lg' 
    - iconSize: 'sm' | 'md' | 'lg' | number 
    - icon: IconSvgElement - Needs icon from Hugeicon library
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
      size="md"
      icon={FlashlightIcon}
      onclick={() => (flashlightOn = !flashlightOn)}
      isActive={flashlightOn}
    ></Button.Icon>
    ```
     -->
