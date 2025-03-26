import type { Snippet } from "svelte";
import { InnerContent } from "./Drawer.stories.snippet.svelte";
import Drawer from "./Drawer.svelte";

export default {
	title: "UI/Drawer",
	component: Drawer,
	tags: ["autodocs"],
	render: (args: { isPaneOpen: boolean; children: Snippet }) => ({
		Component: Drawer,
		props: args,
	}),
};

export const Default = {
	args: {
		isPaneOpen: true,
		children: InnerContent,
	},
};
