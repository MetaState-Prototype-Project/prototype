import type { ComponentProps } from "svelte";
import Avatar from "./Avatar.svelte";

export default {
    title: "UI/Avatar",
    component: Avatar,
    tags: ["autodocs"],
    render: (args: {
        Component: Avatar;
        props: ComponentProps<typeof Avatar>;
    }) => ({
        Component: Avatar,
        props: args,
    }),
};

export const Large = {
    args: {
        src: "https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250",
        size: "lg",
    },
};

export const Medium = {
    args: {
        src: "https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250",
        size: "md",
    },
};

export const Small = {
    args: {
        src: "https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250",
        size: "sm",
    },
};

export const ExtraSmall = {
    args: {
        src: "https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250",
        size: "xs",
    },
};
