import type { ComponentProps } from "svelte";
import {
    ButtonNavSettings,
    ButtonNavText,
} from "./Button.stories.snippet.svelte";
import ButtonNav from "./ButtonNav.svelte";

export default {
    title: "UI/ButtonNav",
    component: ButtonNav,
    tags: ["autodocs"],
    render: (args: {
        Component: ButtonNav;
        props: ComponentProps<typeof ButtonNav>;
    }) => ({
        Component: ButtonNav,
        props: args,
    }),
};

export const Default = {
    args: { href: "#", children: ButtonNavText },
};

export const ForSettings = {
    args: {
        href: "#",
        children: ButtonNavSettings,
        class: "flex items-center justify-between px-3 py-2",
    },
};
