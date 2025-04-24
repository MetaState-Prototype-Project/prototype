import type { ComponentProps, Snippet } from "svelte";
import { InnerContent } from "./Drawer.stories.snippet.svelte";
import Drawer from "./Drawer.svelte";

export default {
    title: "UI/Drawer",
    component: Drawer,
    tags: ["autodocs"],
    render: (args: {
        Component: Drawer;
        props: ComponentProps<typeof Drawer>;
    }) => ({
        Component: Drawer,
        props: args,
    }),
};

export const Default = {
    args: {
        isPaneOpen: true,
        children: InnerContent,
    },
};
