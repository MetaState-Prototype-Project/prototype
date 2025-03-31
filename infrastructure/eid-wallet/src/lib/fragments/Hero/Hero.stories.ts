import type { ComponentProps } from "svelte";
import Hero from "./Hero.svelte";

export default {
	title: "Fragments/Hero",
	component: Hero,
	tags: ["autodocs"],
	render: (args: {
		Component: Hero;
		props: ComponentProps<typeof Hero>;
	}) => ({
		Component: Hero,
		props: args,
	}),
};

export const Basic = {
	args: {
		title: "Create PIN",
		subtitle: "Create a PIN to protect your wallet",
	},
};

export const WithSettings = {
	args: {
		title: "Good morning!",
		subtitle: "Don't forget to drink water.",
		titleClasses: "-mb-2",
		showSettings: true,
	},
};
