import Drawer from './Drawer.svelte'
import { InnerContent } from './Drawer.stories.snippet.svelte'

export default {
  title: 'UI/Drawer',
  component: Drawer,
  tags: ['autodocs'],
  render: (args: { isPaneOpen: boolean; children: any }) => ({
    Component: Drawer,
    props: args,
  }),
}

export const Default = {
  args: {
    isPaneOpen: true,
    children: InnerContent,
  },
}
