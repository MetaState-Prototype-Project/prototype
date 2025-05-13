import type { ComponentProps } from "svelte";
import Header from "./Header.svelte";

export default {
    title: "Fragments/Header",
    component: Header,
    tags: ["autodocs"],
    render: (args: {
        Component: Header;
        props: ComponentProps<typeof Header>;
    }) => ({
        Component: Header,
        props: args,
    }),
};

export const Primary = {
    args: {
        variant: "primary",
        heading: "metagram",
        callback: () => alert("clicked"),
    },
};

export const PrimaryWithNoFlash = {
    args: {
        variant: "primary",
        heading: "messages",
    },
};

export const Secondary = {
    args: {
        variant: "secondary",
        heading: "Account",
    },
};

export const SecondaryWithMenu = {
    args: {
        variant: "secondary",
        heading: "Account",
        callback: () => alert("menu clicked"),
    },
};

export const Tertiary = {
    args: {
        variant: "tertiary",
        callback: () => alert("clicked"),
    },
};
