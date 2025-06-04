import type { ComponentProps } from "svelte";
import SettingsTile from "./SettingsTile.svelte";

export default {
    title: "UI/SettingsTile",
    component: SettingsTile,
    tags: ["autodocs"],
    render: (args: {
        Component: SettingsTile;
        props: ComponentProps<typeof SettingsTile>;
    }) => ({
        Component: SettingsTile,
        props: args,
    }),
};

export const Primary = {
    args: {
        title: "Who can see your posts?",
        currentStatus: "Only followers",
        onclick: () => alert("clicked"),
    },
};
