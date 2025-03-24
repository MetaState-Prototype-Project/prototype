<script lang="ts" generics="T">
  import { cn } from '$lib/utils'
  import type { HTMLButtonAttributes } from 'svelte/elements'

  interface IButtonProps extends HTMLButtonAttributes {
    variant?: 'solid' | 'soft' | 'danger' | 'danger-soft' | 'white'
    isLoading?: boolean
    cb?: () => Promise<void>
    blockingClick?: boolean
    type?: 'button' | 'submit' | 'reset'
    size?: 'sm' | 'md'
  }

  let {
    variant = 'solid',
    isLoading,
    cb,
    blockingClick,
    type = 'button',
    size = 'md',
    children = undefined,
    ...restProps
  }: IButtonProps = $props()

  let isSubmitting = $state(false)
  let disabled = $derived(restProps.disabled || isLoading || isSubmitting)

  const handleClick = async () => {
    if (typeof cb !== 'function') return

    if (blockingClick) isSubmitting = true
    try {
      await cb()
    } catch (error) {
      console.error('Error in button callback:', error)
    } finally {
      isSubmitting = false
    }
  }

  const variantClasses = {
    solid: { background: 'bg-primary-900', text: 'text-white' },
    soft: { background: 'bg-primary-100', text: 'text-primary-900' },
    danger: { background: 'bg-danger-500', text: 'text-white' },
    'danger-soft': { background: 'bg-danger-100', text: 'text-danger-500' },
    white: { background: 'bg-white', text: 'text-black' },
  }

  const disabledVariantClasses = {
    solid: { background: 'bg-primary-500', text: 'text-white' },
    soft: { background: 'bg-primary-100', text: 'text-primary-500' },
    danger: { background: 'bg-danger-300', text: 'text-white' },
    'danger-soft': { background: 'bg-danger-100', text: 'text-danger-300' },
    white: { background: 'bg-black-100', text: 'text-black-700' },
  }

  const padding = {
    sm: 'px-4 py-1.5',
    md: 'px-8 py-2.5',
  }

  let classes = $derived({
    common: cn(
      'cursor-pointer w-min flex items-center justify-center rounded-full text-xl font-semibold h-[56px] duration-100',
      padding[size]
    ),
    background: disabled
      ? disabledVariantClasses[variant].background ||
        variantClasses[variant].background
      : variantClasses[variant].background,
    text: disabled
      ? disabledVariantClasses[variant].text || variantClasses[variant].text
      : variantClasses[variant].text,
    disabled: 'cursor-not-allowed',
  })
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
  onclick={handleClick}
  {type}
>
  <div class="relative flex items-center justify-center">
    {#if isLoading || isSubmitting}
      <div
        class="loading loading-spinner absolute {size === 'md'
          ? 'loading-md -left-4'
          : 'loading-sm -left-3'}"
      ></div>
    {/if}
    <div
      class="flex items-center justify-center duration-100 {isLoading ||
      isSubmitting
        ? size === 'md'
          ? 'translate-x-4'
          : 'translate-x-3'
        : ''}"
    >
      {@render children?.()}
    </div>
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
- cb: A callback function that will be called when the button is clicked.
- blockingClick: A boolean to indicate if the button should block the click event while the callback function is being executed.
- icon: A slot for an icon to be displayed inside the button.
- ...restProps: Any other props that can be passed to a button element.

@usage
```html
<script lang="ts">
    import * as Button from '$lib/ui/Button'
</script>

<Button.Action variant="solid" cb={() => console.log('clicked')}>
  Click me
</Button.Action>
```
 -->
