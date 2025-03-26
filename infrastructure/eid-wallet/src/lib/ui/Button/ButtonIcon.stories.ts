import ButtonIcon from './ButtonIcon.svelte'
import { FlashlightIcon } from '@hugeicons/core-free-icons'
import type { ComponentProps } from 'svelte'

export default {
  title: 'UI/ButtonIcon',
  component: ButtonIcon,
  tags: ['autodocs'],

  parameters: {
    backgrounds: { default: 'dark' },
  },
  render: (args: {
    Component: ButtonIcon<{
      variant: 'white'
      ariaLabel: 'Default button'
      size: 'md'
      icon: typeof FlashlightIcon
    }>
    props: ComponentProps<typeof ButtonIcon>
  }) => ({
    Component: ButtonIcon,
    props: args,
  }),
}

export const Default = {
  render: () => ({
    Component: ButtonIcon,
    props: {
      variant: 'white',
      ariaLabel: 'Default button',
      size: 'md',
      icon: FlashlightIcon,
    },
  }),
}

export const Loading = {
  render: () => ({
    Component: ButtonIcon,
    props: {
      variant: 'white',
      ariaLabel: 'Loading button',
      size: 'md',
      icon: FlashlightIcon,
      isLoading: true,
    },
  }),
}

export const Active = {
  render: () => ({
    Component: ButtonIcon,
    props: {
      variant: 'white',
      ariaLabel: 'Active button',
      size: 'md',
      icon: FlashlightIcon,
      isActive: true,
    },
  }),
}
