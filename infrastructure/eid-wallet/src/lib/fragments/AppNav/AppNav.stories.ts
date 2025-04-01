import type { ComponentProps } from "svelte";
import AppNav from "./AppNav.svelte";

export default {
	title: "Fragments/AppNav",
	component: AppNav,
	tags: ["autodocs"],
	render: (args: {
		Component: AppNav;
		props: ComponentProps<typeof AppNav>;
	}) => ({
		Component: AppNav,
		props: args,
	}),
};

export const Basic = {
	args: {
		title: "Settings",
	},
};
