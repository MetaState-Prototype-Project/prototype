<script lang="ts" generics="T">
  import { cn } from '$lib/utils'
  import type { Snippet } from 'svelte'
  import type { HTMLButtonAttributes } from 'svelte/elements'

  interface IButtonProps extends HTMLButtonAttributes {
    variant?: 'solid' | 'soft' | 'danger' | 'danger-soft'
    isLoading?: boolean
    cb?: () => Promise<void>
    blockingClick?: boolean
    icon?: Snippet
  }

  let {
    variant = 'solid',
    isLoading,
    cb,
    blockingClick,
    children = undefined,
    ...restProps
  }: IButtonProps = $props()

  let isSubmitting = $state(false)
  let disabled = $derived(restProps.disabled || isLoading || isSubmitting)

  const handleClick = async () => {
    if (!cb) return

    if (blockingClick) isSubmitting = true
    await cb().catch(() => (isSubmitting = false))
    isSubmitting = false
  }

  const variantClasses = {
    solid: { background: 'bg-primary-900', text: 'text-white' },
    soft: { background: 'bg-primary-100', text: 'text-primary-900' },
    danger: { background: 'bg-danger-500', text: 'text-white' },
    'danger-soft': { background: 'bg-danger-300', text: 'text-danger-500' },
  }

  const disabledVariantClasses = {
    solid: { background: 'bg-primary-500', text: 'text-white' },
    soft: { background: 'bg-primary-100', text: 'text-primary-500' },
    danger: { background: 'bg-danger-500', text: 'text-white' },
    'danger-soft': { background: 'bg-danger-300', text: 'text-danger-500' },
  }

  let classes = $derived({
    common:
      'cursor-pointer flex items-center justify-center px-8 py-2.5 rounded-full text-xl font-semibold h-[56px] duration-100',
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
>
  <div class="relative flex items-center justify-center">
    {#if isLoading || isSubmitting}
      <div class="loading loading-spinner loading-md absolute -left-4"></div>
    {/if}
    <div
      class="flex items-center justify-center duration-100"
      class:translate-x-4={isLoading || isSubmitting}
    >
      {@render children?.()}
    </div>
  </div>
</button>
