import type { Meta, StoryObj } from '@storybook/svelte'
import ButtonAction from './ButtonAction.svelte'
import { ButtonText } from './ButtonSnippets.svelte'

const meta: Meta<ButtonAction> = {
  title: 'Components/ButtonAction',
  component: ButtonAction,
  args: {
    variant: 'solid',
    isLoading: false,
    blockingClick: false,
    children: 'Click Me', // Ensure this is a function returning text
  },
  argTypes: {
    variant: {
      control: {
        type: 'select',
        options: ['solid', 'soft', 'danger', 'danger-soft'],
      },
    },
    isLoading: { control: 'boolean' },
    blockingClick: { control: 'boolean' },
    cb: { action: 'clicked' },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Solid: Story = {
  args: { variant: 'solid', children: ButtonText },
}

export const Soft: Story = {
  args: { variant: 'soft', children: ButtonText },
}

export const Danger: Story = {
  args: { variant: 'danger', children: ButtonText },
}

export const DangerSoft: Story = {
  args: { variant: 'danger-soft', children: ButtonText },
}

export const Loading: Story = {
  args: { isLoading: true, children: ButtonText },
}

export const BlockingClick: Story = {
  args: {
    blockingClick: true,
    children: ButtonText,
    cb: async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    },
  },
}
