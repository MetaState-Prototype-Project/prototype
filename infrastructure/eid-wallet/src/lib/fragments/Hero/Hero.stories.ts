import Hero from "./Hero.svelte";

export default {
	title: "Fragments/Hero",
	component: Hero,
	tags: ["autodocs"],
	render: (args: {
		title: string;
		isBackRequired: boolean;
		isUserLoggedIn: boolean;
	}) => ({
		Component: Hero,
		props: args,
	}),
};

export const Primary = {
	args: {
		title: "Create PIN",
		isBackRequired: false,
		isUserLoggedIn: false,
	},
};

export const Secondary = {
	args: {
		title: "Create PIN",
		isBackRequired: true,
		isUserLoggedIn: false,
	},
};

export const Tertiary = {
	args: {
		title: "Create PIN",
		isBackRequired: true,
		isUserLoggedIn: true,
	},
};
