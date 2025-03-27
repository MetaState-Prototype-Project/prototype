import type { ComponentProps } from "svelte";
import { ButtonText } from "./Button.stories.snippet.svelte";
import ButtonAction from "./ButtonAction.svelte";

export default {
	title: "UI/ButtonAction",
	component: ButtonAction,
	tags: ["autodocs"],
	render: (args: {
		Component: ButtonAction;
		props: ComponentProps<typeof ButtonAction>;
	}) => ({
		Component: ButtonAction,
		props: args,
	}),
};

export const Solid = {
	args: { variant: "solid", children: ButtonText },
};

export const Soft = {
	args: { variant: "soft", children: ButtonText },
};

export const Danger = {
	args: { variant: "danger", children: ButtonText },
};

export const DangerSoft = {
	args: { variant: "danger-soft", children: ButtonText },
};

export const Loading = {
	args: { isLoading: true, children: ButtonText },
};

export const BlockingClick = {
	args: {
		blockingClick: true,
		children: ButtonText,
		callback: async () => {
			await new Promise((resolve) => setTimeout(resolve, 2000));
		},
	},
};
