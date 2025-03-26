import type { Snippet } from "svelte";
import SettingsNavigationBtn from "./SettingsNavigationBtn.svelte";
import { icon } from "./SettingsNavigationBtn.stories.snippet.svelte";

export default {
	title: "Fragments/SettingsNavigationBtn",
	component: SettingsNavigationBtn,
	tags: ["autodocs"],
	render: (args: { icon: Snippet; label: string; onClick: () => void }) => ({
		Component: SettingsNavigationBtn,
		props: args,
	}),
};

export const Primary = {
	args: {
		icon: icon,
		label: "Language",
		onClick: () => alert("asdf"),
	},
};
