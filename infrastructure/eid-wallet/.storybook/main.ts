import type { StorybookConfig } from '@storybook/sveltekit'

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|ts)'],
  addons: [
    '@storybook/addon-essentials',
    '@chromatic-com/storybook',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/sveltekit',
    options: {},
  },
}
export default config
