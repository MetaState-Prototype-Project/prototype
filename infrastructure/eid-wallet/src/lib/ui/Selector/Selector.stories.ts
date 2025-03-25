import Selector from './Selector.svelte'
import {
  BasicContent,
  WithIconContent,
} from './Selector.stories.snippet.svelte'
import type { ComponentProps } from 'svelte'

export default {
  title: 'UI/Selector',
  component: Selector,
  tags: ['autodocs'],
  render: (args: {
    Component: Selector
    props: ComponentProps<typeof Selector>
  }) => ({
    Component: Selector,
    props: args,
  }),
}

export const WithIcon = {
  render: () => ({
    Component: Selector,
    props: {
      id: 'option-1',
      name: 'lang',
      value: 'option-1',
      selected: 'option-1',
      icon: WithIconContent,
      children: BasicContent,
    },
  }),
}

export const WithoutIcon = {
  render: () => ({
    Component: Selector,
    props: {
      id: 'option-1',
      name: 'lang',
      value: 'option-1',
      selected: 'option-1',
      children: BasicContent,
    },
  }),
}
