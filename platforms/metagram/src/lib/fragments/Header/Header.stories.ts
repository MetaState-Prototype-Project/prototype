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
    },
};

// export const Large = {
//     args: {
//         src: "https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250",
//         size: "lg",
//     },
// };

// export const Medium = {
//     args: {
//         src: "https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250",
//         size: "md",
//     },
// };

// export const Small = {
//     args: {
//         src: "https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250",
//         size: "sm",
//     },
// };

// export const ExtraSmall = {
//     args: {
//         src: "https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250",
//         size: "xs",
//     },
// };
