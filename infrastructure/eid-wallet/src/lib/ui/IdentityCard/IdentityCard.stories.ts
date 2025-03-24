import IdentityCard from "./IdentityCard.svelte";

export default {
	title: "UI/IdentityCard",
	component: IdentityCard,
	tags: ["autodocs"],
	render: (args: any) => ({
		Component: IdentityCard,
		props: args,
	}),
};

export const Primary = {
	args: {},
};
