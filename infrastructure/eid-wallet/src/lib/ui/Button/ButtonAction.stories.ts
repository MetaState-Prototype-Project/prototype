import type { Meta, StoryObj } from '@storybook/svelte'
import ButtonAction from './ButtonAction.svelte'
import { ButtonText } from './ButtonSnippets.svelte'

export default {
  title: 'UI/ButtonAction',
  component: ButtonAction,
  args: {
    variant: 'solid',
    isLoading: false,
    blockingClick: false,
    children: 'Click Me',
  },
  argTypes: {
    variant: {
      control: {
        type: 'select',
        options: ['solid', 'soft', 'danger', 'danger-soft', 'white'],
      },
    },
    size: {
      control: {
        type: 'select',
        options: ['sm', 'md'],
      },
    },
    isLoading: { control: 'boolean' },
    blockingClick: { control: 'boolean' },
    callback: { action: 'clicked' },
  },
}

export const Solid = {
  args: { variant: 'solid', children: ButtonText },
}

export const Soft = {
  args: { variant: 'soft', children: ButtonText },
}

export const Danger = {
  args: { variant: 'danger', children: ButtonText },
}

export const DangerSoft = {
  args: { variant: 'danger-soft', children: ButtonText },
}

export const Loading = {
  args: { isLoading: true, children: ButtonText },
}

export const BlockingClick = {
  args: {
    blockingClick: true,
    children: ButtonText,
    callback: async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    },
  },
}
