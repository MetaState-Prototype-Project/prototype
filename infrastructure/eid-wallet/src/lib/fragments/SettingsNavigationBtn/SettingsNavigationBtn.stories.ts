import type { Snippet } from "svelte";
import { icon } from "./SettingsNavigationBtn.stories.snippet.svelte";
import SettingsNavigationBtn from "./SettingsNavigationBtn.svelte";

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
