import { LanguageSquareIcon } from "@hugeicons/core-free-icons";
import type { ComponentProps } from "svelte";
import SettingsNavigationBtn from "./SettingsNavigationBtn.svelte";

export default {
	title: "Fragments/SettingsNavigationBtn",
	component: SettingsNavigationBtn,
	tags: ["autodocs"],
	render: (args: {
		Component: SettingsNavigationBtn;
		props: ComponentProps<typeof SettingsNavigationBtn>;
	}) => ({
		Component: SettingsNavigationBtn,
		props: args,
	}),
};

export const Primary = {
	args: {
		icon: LanguageSquareIcon,
		label: "Language",
		href: "#",
	},
};
