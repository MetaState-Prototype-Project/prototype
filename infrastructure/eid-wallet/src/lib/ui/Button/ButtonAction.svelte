<script lang="ts">
import { cn } from "$lib/utils";
import type { HTMLButtonAttributes } from "svelte/elements";

interface IButtonProps extends HTMLButtonAttributes {
    variant?: "solid" | "soft" | "danger" | "danger-soft" | "white";
    isLoading?: boolean;
    callback?: () => Promise<void> | void;
    blockingClick?: boolean;
    type?: "button" | "submit" | "reset";
    size?: "sm" | "md";
}

const {
    variant = "solid",
    isLoading,
    callback,
    onclick,
    blockingClick,
    type = "button",
    size = "md",
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
    solid: { background: "bg-primary-500", text: "text-white" },
    soft: { background: "bg-primary-100", text: "text-primary-500" },
    danger: { background: "bg-danger-500", text: "text-white" },
    "danger-soft": { background: "bg-danger-100", text: "text-danger-500" },
    white: { background: "bg-white", text: "text-black" },
};

const disabledVariantClasses = {
    solid: { background: "bg-primary-300", text: "text-white" },
    soft: { background: "bg-primary-100", text: "text-primary-300" },
    danger: { background: "bg-danger-400", text: "text-white" },
    "danger-soft": { background: "bg-danger-100", text: "text-danger-400" },
    white: { background: "bg-black-100", text: "text-black-700" },
};

const sizeVariant = {
    sm: "px-4 py-1.5 text-base h-11",
    md: "px-8 py-2.5 text-xl h-14",
};

const classes = $derived({
    common: cn(
        "cursor-pointer w-min flex items-center justify-center rounded-full font-semibold duration-100",
        sizeVariant[size],
    ),
    background: disabled
        ? disabledVariantClasses[variant].background ||
          variantClasses[variant].background
        : variantClasses[variant].background,
    text: disabled
        ? disabledVariantClasses[variant].text || variantClasses[variant].text
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
        ].join(" ")
    )}
    {disabled}
    onclick={handleClick}
    {type}
>
    <div class="relative flex items-center justify-center">
        <div
            class="flex items-center justify-center duration-100"
            class:blur-xs={isLoading || isSubmitting}
        >
            {@render children?.()}
        </div>
        {#if isLoading || isSubmitting}
            <div
                class="loading loading-spinner absolute loading-xl text-white"
            ></div>
        {/if}
    </div>
</button>

<!--
@component
export default ButtonAction
@description
This component is a button with a loading spinner that can be used to indicate that an action is being performed.

@props
- variant: The variant of the button. Default is `solid`.
- size: The size of the button. Default is `md`.
- isLoading: A boolean to indicate if the button is in a loading state.
- callback: A callback function that will be called when the button is clicked.
- blockingClick: A boolean to indicate if the button should block the click event while the callback function is being executed.
- icon: A slot for an icon to be displayed inside the button.
- ...restProps: Any other props that can be passed to a button element.

@usage
```html
<script lang="ts">
    import * as Button from '$lib/ui/Button'
</script>

<Button.Action variant="solid" callback={() => console.log('clicked')}>
  Click me
</Button.Action>
```
 -->
