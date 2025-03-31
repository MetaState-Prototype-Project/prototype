import type { StorybookConfig } from "@storybook/sveltekit";
import { join, dirname } from "path";

function getAbsolutePath(value: string): any {
	return dirname(require.resolve(join(value, "package.json")));
}

const config: StorybookConfig = {
	stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|ts)"],
	addons: [
		getAbsolutePath("@storybook/addon-essentials"),
		getAbsolutePath("@chromatic-com/storybook"),
		getAbsolutePath("@storybook/experimental-addon-test"),
	],
	framework: {
		name: "@storybook/sveltekit",
		options: {},
	},

	staticDirs: ["../static"],
};
export default config;
